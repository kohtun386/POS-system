/**
 * E2E Test: platform-admin-cleanup Edge Function
 *
 * Tests the dry‑run preview and destructive cleanup paths.
 * Verifies seed fixtures (Free/Growth/Pro shops, tier accounts,
 * platform_admin) are preserved.
 */
import { test, expect } from '../fixtures';
import { TEST_ADMIN } from '../helpers/test-users';
import { deleteRows, waitForShopActive, waitForUserActive } from '../helpers/db-helpers';

const MAILPIT_URL = process.env.MAILPIT_URL || 'http://127.0.0.1:54324';
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function callCleanupEF(dryRun: boolean): Promise<{
  success: boolean;
  dry_run: boolean;
  rpc_result: Record<string, unknown>;
  auth_users_deleted: number;
}> {
  const response = await fetch(`${VITE_SUPABASE_URL}/functions/v1/platform-admin-cleanup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dry_run: dryRun }),
  });
  return response.json();
}

async function countShopInPublicUsers(emailPattern: string): Promise<number> {
  const url = new URL(`${VITE_SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set('email', `like.${emailPattern}`);
  url.searchParams.set('select', 'id');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function countShopsByNamePattern(pattern: string): Promise<number> {
  const url = new URL(`${VITE_SUPABASE_URL}/rest/v1/shops`);
  url.searchParams.set('name', `like.${pattern}`);
  url.searchParams.set('select', 'id');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

test.describe('Platform Admin Cleanup', () => {
  test.setTimeout(90000);

  // ── Test 1: dry_run=true returns preview, no changes ───────────────
  test('dry‑run returns preview counts without deleting', async ({ page }) => {
    // Create a fresh test shop via onboarding flow.
    const timestamp = Date.now();
    const uniqueEmail = `onboarding-${timestamp}@coffeeshop.local`;
    const shopName = `E2E Shop ${timestamp}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Don\'t have an account? Sign up")');
    await page.fill('input[placeholder="Enter your full name"]', 'Cleanup Test User');
    await page.fill('input[placeholder="Choose a username"]', `cleanup_user_${timestamp}`);
    await page.fill('input[placeholder="Enter your shop name"]', shopName);
    await page.fill('input[placeholder="Enter your email"]', uniqueEmail);
    await page.fill('input[placeholder="Enter your password"]', 'Test1234!');
    await page.click('button:has-text("Create Account")');

    // Wait for pending approval screen
    await expect(page.locator('h1:has-text("Pending Approval")')).toBeVisible({ timeout: 10000 });

    // Sign out and log in as platform admin
    await page.click('button:has-text("Sign Out")');
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', TEST_ADMIN.email);
    await page.fill('input[type="password"]', TEST_ADMIN.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('button:has-text("Pending Shops")')).toBeVisible({ timeout: 15000 });

    // Navigate to Pending Shops to ensure shop exists in DB
    await page.click('text="Pending Shops"');
    await expect(page.locator('h1:has-text("Pending Shop Approvals")')).toBeVisible({ timeout: 30000 });

    // Now call the cleanup EF with dry_run = true
    const result = await callCleanupEF(true);
    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.rpc_result).toBeDefined();
    expect(result.rpc_result.preview_counts).toBeDefined();
    expect(result.rpc_result.preview_counts.shops).toBeGreaterThanOrEqual(1);

    // Verify DB still has the test shop (no deletion happened)
    const shopsAfterDryRun = await countShopsByNamePattern('E2E Shop%');
    expect(shopsAfterDryRun).toBeGreaterThanOrEqual(1);

    // Verify seed shops still exist (Free, Growth, Pro)
    const freeShop = await countShopsByNamePattern('Free Shop');
    const growthShop = await countShopsByNamePattern('Growth Shop');
    const proShop = await countShopsByNamePattern('Pro Shop');
    expect(freeShop).toBe(1);
    expect(growthShop).toBe(1);
    expect(proShop).toBe(1);
  });

  // ── Test 2: dry_run=false deletes test data, preserves fixtures ────
  test('destructive run deletes onboarding test data, preserves fixtures', async ({ page }) => {
    // Create another fresh test shop
    const timestamp = Date.now() + 1;
    const uniqueEmail = `onboarding-${timestamp}@coffeeshop.local`;
    const shopName = `E2E Shop ${timestamp}`;

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Don\'t have an account? Sign up")');
    await page.fill('input[placeholder="Enter your full name"]', 'Cleanup Test User 2');
    await page.fill('input[placeholder="Choose a username"]', `cleanup_user_${timestamp}`);
    await page.fill('input[placeholder="Enter your shop name"]', shopName);
    await page.fill('input[placeholder="Enter your email"]', uniqueEmail);
    await page.fill('input[placeholder="Enter your password"]', 'Test1234!');
    await page.click('button:has-text("Create Account")');

    // Wait for pending approval screen
    await expect(page.locator('h1:has-text("Pending Approval")')).toBeVisible({ timeout: 10000 });

    // Call cleanup with dry_run = false
    const result = await callCleanupEF(false);
    expect(result.success).toBe(true);
    expect(result.dry_run).toBe(false);
    expect(result.rpc_result).toBeDefined();
    expect(result.rpc_result.deleted_counts).toBeDefined();
    expect(result.rpc_result.deleted_counts.shops).toBeGreaterThanOrEqual(1);
    expect(result.auth_users_deleted).toBeGreaterThanOrEqual(1);

    // Verify the specific test shop is gone (by exact name, not pattern —
    // old active E2E shops from prior runs may still exist)
    const url = new URL(`${VITE_SUPABASE_URL}/rest/v1/shops`);
    url.searchParams.set('name', `eq.${shopName}`);
    url.searchParams.set('select', 'id');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    });
    const rows = await res.json();
    expect(Array.isArray(rows) ? rows.length : 0).toBe(0);

    // Verify seed shops still exist
    const freeShop = await countShopsByNamePattern('Free Shop');
    const growthShop = await countShopsByNamePattern('Growth Shop');
    const proShop = await countShopsByNamePattern('Pro Shop');
    expect(freeShop).toBe(1);
    expect(growthShop).toBe(1);
    expect(proShop).toBe(1);

    // Verify tier accounts (@test.local) still exist
    const tierUsers = await countShopInPublicUsers('%@test.local');
    expect(tierUsers).toBeGreaterThan(0); // at least the 8 tier accounts from seed

    // Verify platform_admin user (test-admin@coffeeshop.local) still exists
    const platformAdmin = await countShopInPublicUsers('%test-admin@coffeeshop.local');
    expect(platformAdmin).toBe(1);
  });

  // ── Test 3: Idempotency — second run returns zero counts ───────────
  test('cleanup is idempotent (second run returns zero counts)', async () => {
    // Run cleanup again (no new test data created since Test 2)
    const result = await callCleanupEF(false);
    expect(result.success).toBe(true);
    expect(result.rpc_result.deleted_counts.shops).toBe(0);
    expect(result.rpc_result.deleted_counts.users).toBe(0);
    expect(result.rpc_result.deleted_counts.shop_memberships).toBe(0);
    expect(result.rpc_result.deleted_counts.app_settings).toBe(0);
    expect(result.rpc_result.deleted_counts.audit_logs).toBe(0);
  });
});
