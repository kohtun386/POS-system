/**
 * E2E Test: Tier Gating (Capability-Based Feature Visibility)
 *
 * Journey 3.1: Free tier user does NOT see "Purchases" or "Stock" tabs
 * Journey 3.2: Upgrading to Growth tier reveals "Purchases" and "Stock" tabs
 * Journey 3.3: Upgrading to Pro tier reveals "Simple Profit" tab in Reports
 *
 * Uses tierPage fixture for initial free-tier capabilities (via route interception).
 * Mid-test tier changes use applyCapabilities() to dispatch SET_CAPABILITIES
 * directly into the React app state — no page reload needed.
 * Tests that need non-free tiers set up their own intercept before login.
 */
import { test, expect } from '../fixtures'
import { setupTier, reloadForCapabilities, waitForInitialLoad } from '../helpers/tier-helpers'
import { loginViaUI, TEST_ADMIN_MANAGER } from '../helpers/test-users'

test.describe('Tier Gating', () => {
  test('3.1: Free tier hides Purchases and Stock tabs', async ({
    tierPage: page,
  }) => {
    // tierPage fixture intercepts resolve_capabilities with 'free' tier caps

    // Desktop nav buttons for Purchases and Stock should NOT exist
    const purchasesBtn = page.locator('nav button', { hasText: 'Purchases' })
    const stockBtn = page.locator('nav button', { hasText: 'Stock' })

    await expect(purchasesBtn).toHaveCount(0, { timeout: 10000 })
    await expect(stockBtn).toHaveCount(0, { timeout: 10000 })

    // Reports tab should be visible (admin role)
    const reportsBtn = page.locator('nav button', { hasText: 'Reports' })
    await expect(reportsBtn).toBeVisible({ timeout: 10000 })
  })

  test('3.2: Growth tier reveals Purchases and Stock tabs', async ({
    tierPage: page,
  }) => {
    // Starts with free tier — tabs should be hidden
    await expect(page.locator('nav button', { hasText: 'Purchases' })).toHaveCount(0, { timeout: 10000 })
    await expect(page.locator('nav button', { hasText: 'Stock' })).toHaveCount(0)

    // Wait for initial data load to finish before switching tiers.
    // loadData() is async and its resolveCapabilitiesRpc() call will
    // overwrite any caps we dispatch if it hasn't completed yet.
    await waitForInitialLoad(page)

    // Switch to growth tier by dispatching SET_CAPABILITIES into React state
    await reloadForCapabilities(page, 'growth')

    // Purchases and Stock tabs should now be visible — re-locate after re-render
    await expect(page.locator('nav button', { hasText: 'Purchases' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('nav button', { hasText: 'Stock' })).toBeVisible({ timeout: 10000 })

    // Click Purchases — verify the Purchase Log page loads
    await page.locator('nav button', { hasText: 'Purchases' }).click()
    await expect(page.locator('h1', { hasText: 'Purchase Log' })).toBeVisible({
      timeout: 10000,
    })

    // Click Stock — verify the Stock Overview page loads
    await page.locator('nav button', { hasText: 'Stock' }).click()
    await expect(page.locator('h1', { hasText: 'Stock Overview' })).toBeVisible({
      timeout: 10000,
    })
  })

  test('3.3: Pro tier reveals Simple Profit tab in Reports', async ({
    page,
  }) => {
    // Set up pro-tier intercept BEFORE login so loadData() gets correct caps
    await setupTier(page, 'pro')
    await loginViaUI(page, TEST_ADMIN_MANAGER.email, TEST_ADMIN_MANAGER.password)
    await expect(page.locator('nav button', { hasText: 'Reports' })).toBeVisible({ timeout: 15000 })

    // Navigate to Reports
    await page.locator('nav button', { hasText: 'Reports' }).click()

    // Wait for ReportsManager to render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit from dropdown
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Verify SimpleProfitReport renders
    await expect(page.locator('h3', { hasText: 'Profit Calculation' })).toBeVisible({
      timeout: 10000,
    })

    // Verify KPI cards are visible
    // nth(1) skips the hidden <option> in the dropdown, targets the visible card
    await expect(page.locator('text=Revenue').first()).toBeVisible()
    await expect(page.locator('text=Purchases').first()).toBeVisible()
    await expect(page.locator('text=Net Profit')).toBeVisible()
  })
})
