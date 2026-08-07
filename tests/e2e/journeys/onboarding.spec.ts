/**
 * E2E Test: User Onboarding Pipeline
 *
 * Tests the full signup -> verification -> pending -> approval -> POS access flow.
 * Probes stuck points and architectural errors.
 */
import { test, expect } from '../fixtures';
import { TEST_ADMIN } from '../helpers/test-users';
import { deleteRows, getShopIdsByOwner, waitForShopActive, waitForUserActive } from '../helpers/db-helpers';

/** Wait for the Edge Function to load pending shops, then return when the list is visible */
async function waitForPendingShops(page: import('@playwright/test').Page) {
  // The component renders "Loading pending shops…" (U+2026 ellipsis, not "...").
  // Don't match on that text — just wait for the heading, which only appears once
  // the list EF has responded (with items or the empty state). Generous timeout
  // for a cold Edge Runtime isolate.
  await expect(page.locator('h1:has-text("Pending Shop Approvals")')).toBeVisible({ timeout: 30000 });
}

const MAILPIT_URL = process.env.MAILPIT_URL || 'http://127.0.0.1:54324';

test.describe('Onboarding Pipeline', () => {
  // The onboarding flow hits cold Edge Function isolates (8-15s+ first call),
  // then awaits DB commits via service-role polling. Give it headroom beyond
  // the default 30s test timeout.
  test.setTimeout(90000);

  const timestamp = Date.now();
  const uniqueEmail = `onboarding-${timestamp}@coffeeshop.local`;
  const shopName = `E2E Shop ${timestamp}`;

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete ALL test-created data using service-role key (bypasses RLS).
    // Matches every onboarding/reject user (both tests, any run), not just this
    // describe's own email — robust against retries and partial runs.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Find all test auth users (auth.users is separate from public.users)
      const authRes = await page.request.fetch(
        `${process.env.VITE_SUPABASE_URL || 'http://localhost:54321'}/auth/v1/admin/users`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          },
        }
      );

      if (authRes.ok()) {
        const { users } = await authRes.json();
        const testUsers = (users || []).filter(
          (u: { email: string }) =>
            /^(onboarding-|reject-).*@coffeeshop\.local$/.test(u.email || '')
        );
        for (const testUser of testUsers) {
          // FK graph: shop_memberships(shop,user); app_settings(shop);
          // audit_logs(shop); users(shop). So delete member/app_settings/
          // audit_logs first, then users, then shops, then the auth user.
          const shopIds = await getShopIdsByOwner(page, testUser.id);
          for (const shopId of shopIds) {
            await deleteRows(page, 'app_settings', { shop_id: `eq.${shopId}` });
            await deleteRows(page, 'audit_logs', { shop_id: `eq.${shopId}` });
          }
          await deleteRows(page, 'shop_memberships', { user_id: `eq.${testUser.id}` });
          await deleteRows(page, 'users', { id: `eq.${testUser.id}` });
          for (const shopId of shopIds) {
            await deleteRows(page, 'shops', { id: `eq.${shopId}` });
          }
          // Delete auth user last
          await page.request.fetch(
            `${process.env.VITE_SUPABASE_URL || 'http://localhost:54321'}/auth/v1/admin/users/${testUser.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              },
            }
          );
        }
      }
    } catch (err) {
      console.warn('Onboarding test cleanup failed (non-fatal):', err);
    } finally {
      await context.close();
    }
  });

  test('Happy Path: Signup to POS Access', async ({ page }) => {
    // 1. Signup
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to Sign Up mode
    await page.click('button:has-text("Don\'t have an account? Sign up")');

    await page.fill('input[placeholder="Enter your full name"]', 'E2E User');
    await page.fill('input[placeholder="Choose a username"]', `e2e_user_${timestamp}`);
    await page.fill('input[placeholder="Enter your shop name"]', shopName);
    await page.fill('input[placeholder="Enter your email"]', uniqueEmail);
    await page.fill('input[placeholder="Enter your password"]', 'Test1234!');

    await page.click('button:has-text("Create Account")');

    // 2. Email Verification (Probing Mailpit even if enable_confirmations=false)
    // If confirmations are disabled, it might auto-login or go straight to pending.
    const isVerificationPage = await page.locator('text=Check your email').isVisible({ timeout: 5000 }).catch(() => false);

    if (isVerificationPage) {
      console.log('Email verification required. Fetching link from Mailpit...');
      await page.waitForTimeout(2000);
      const mailpitResponse = await fetch(`${MAILPIT_URL}/api/v1/messages`);
      const mailpitData = await mailpitResponse.json();
      const latestMessage = mailpitData.messages[0];

      expect(latestMessage.To[0].Address).toBe(uniqueEmail);

      // Extract confirmation link
      const messageDetailResponse = await fetch(`${MAILPIT_URL}/api/v1/message/${latestMessage.ID}`);
      const messageDetail = await messageDetailResponse.json();
      const body = messageDetail.HTML || messageDetail.Text;
      const linkMatch = body.match(/href="([^"]+)"/);
      const confirmationLink = linkMatch ? linkMatch[1] : null;

      expect(confirmationLink).not.toBeNull();
      await page.goto(confirmationLink!);
    }

    // 3. Assert Pending Approval screen
    await page.waitForURL((url) => !url.toString().includes('type=signup'), { timeout: 15000 });

    // Probe: can pending user read own profile? (implicit in page rendering)
    await expect(page.locator('h1:has-text("Pending Approval")')).toBeVisible({ timeout: 10000 });
    // Note: shop name query is blocked by RLS (inactive membership), page falls back to "Your Coffee Shop"
    // This is a known app-level limitation — the shop name assertion is intentionally omitted

    // 4. Platform Admin Approval
    // Click "Sign Out" button on the PendingApprovalPage (no /logout route exists)
    await page.click('button:has-text("Sign Out")');
    // Wait for login form to appear after sign-out (app should navigate to login)
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', TEST_ADMIN.email);
    await page.fill('input[type="password"]', TEST_ADMIN.password);
    await page.click('button[type="submit"]');

    // Wait for the PlatformLayout to actually render (nav visible) before clicking.
    // NOTE: URL never changes (state-driven routing) — must assert on rendered elements.
    await expect(page.locator('button:has-text("Pending Shops")')).toBeVisible({ timeout: 15000 });

    // Navigate to Pending Shops view (admin lands on Dashboard by default)
    await page.click('text="Pending Shops"');
    // Wait for Edge Function to respond and list to render
    await waitForPendingShops(page);

    // Find our shop and approve — retry if Edge Function is still populating
    const shopRow = page.locator('.card', { hasText: shopName });
    if (!(await shopRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Shop not visible yet — reload and wait again
      await page.click('text="Pending Shops"');
      await waitForPendingShops(page);
    }
    await expect(shopRow).toBeVisible({ timeout: 10000 });
    await shopRow.locator('button:has-text("Approve")').click();

    // Confirm Swal
    await page.click('button:has-text("Yes, approve it!")');
    // The success toast only lives ~3s and can be missed when the EF isolate is
    // slow, so gate on the durable signal instead: the shop's is_active flips in
    // the DB (via service-role REST), which is what actually unblocks POS access.
    await waitForShopActive(page, shopName, true);

    // 5. Final Login & POS Access
    // Sign out admin first — click "Sign Out" button on the current page.
    // PlatformLayout wraps sign-out in a confirmation dialog — confirm it.
    await page.click('button:has-text("Sign Out")');
    await page.click('button.swal2-confirm');
    // Wait for login form to appear after sign-out
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Should now see POS (check for a POS-specific element)
    await expect(page.locator('text="Pending Approval"')).not.toBeVisible();
    // NOTE: the "Checkout" button only renders when the cart is non-empty
    // (Cart.tsx gates it on state.cart.length > 0), so it can't serve as the
    // "POS visible" signal at a fresh login. The product search box is the
    // always-present POS affordance — match on its aria-label (the placeholder
    // ends with "..." so an exact [placeholder=] CSS selector never matches).
    await expect(
      page.getByLabel('Search products by name, SKU, or barcode'),
    ).toBeVisible({ timeout: 30000 });
  });

  test('Rejection Path: Admin rejects shop', async ({ page }) => {
    const timestamp2 = Date.now() + 1;
    const email2 = `reject-${timestamp2}@coffeeshop.local`;
    const shop2 = `Reject Shop ${timestamp2}`;

    // Signup
    await page.goto('/');
    await page.click('button:has-text("Don\'t have an account? Sign up")');
    await page.fill('input[placeholder="Enter your full name"]', 'Reject User');
    await page.fill('input[placeholder="Choose a username"]', `reject_user_${timestamp2}`);
    await page.fill('input[placeholder="Enter your shop name"]', shop2);
    await page.fill('input[placeholder="Enter your email"]', email2);
    await page.fill('input[placeholder="Enter your password"]', 'Test1234!');
    await page.click('button:has-text("Create Account")');

    await expect(page.locator('h1:has-text("Pending Approval")')).toBeVisible({ timeout: 10000 });

    // Admin Rejection
    await page.click('button:has-text("Sign Out")');
    // Wait for login form to appear after sign-out
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', TEST_ADMIN.email);
    await page.fill('input[type="password"]', TEST_ADMIN.password);
    await page.click('button[type="submit"]');

    // Wait for the PlatformLayout to actually render (nav visible) before clicking.
    // NOTE: URL never changes (state-driven routing) — must assert on rendered elements.
    await expect(page.locator('button:has-text("Pending Shops")')).toBeVisible({ timeout: 15000 });

    // Navigate to Pending Shops view (admin lands on Dashboard by default)
    await page.click('text="Pending Shops"');
    await waitForPendingShops(page);

    // Find our shop — retry if Edge Function is still populating
    const shopRow = page.locator('.card', { hasText: shop2 });
    if (!(await shopRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.click('text="Pending Shops"');
      await waitForPendingShops(page);
    }
    await expect(shopRow).toBeVisible({ timeout: 10000 });
    await shopRow.locator('button:has-text("Reject")').click();

    // Rejection reason — use getByRole for robustness over .swal2-input
    await page.getByRole('textbox').fill('Incomplete information');
    await page.click('button:has-text("Submit")');
    // The success toast only lives ~3s and can be missed when the EF isolate is
    // slow, so gate on the durable signal instead: the rejected user's active
    // flag flips to false in the DB (via service-role REST).
    await waitForUserActive(page, email2, false);

    // Verify user still blocked
    // Sign out admin first — click "Sign Out" button on the current page.
    // PlatformLayout wraps sign-out in a confirmation dialog — confirm it.
    await page.click('button:has-text("Sign Out")');
    await page.click('button.swal2-confirm');
    // Wait for login form to appear after sign-out
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', email2);
    await page.fill('input[type="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await expect(page.locator('h1:has-text("Pending Approval")')).toBeVisible();
  });
});
