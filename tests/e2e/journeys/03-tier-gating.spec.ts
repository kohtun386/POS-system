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
 */
import { test, expect } from '../fixtures'
import { reloadForCapabilities } from '../helpers/tier-helpers'

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

    // Switch to growth tier by dispatching SET_CAPABILITIES into React state
    await reloadForCapabilities(page, 'growth')

    // Purchases and Stock tabs should now be visible
    const purchasesBtn = page.locator('nav button', { hasText: 'Purchases' })
    const stockBtn = page.locator('nav button', { hasText: 'Stock' })

    await expect(purchasesBtn).toBeVisible({ timeout: 10000 })
    await expect(stockBtn).toBeVisible({ timeout: 10000 })

    // Click Purchases — verify the Purchase Log page loads
    await purchasesBtn.click()
    await expect(page.locator('h1', { hasText: 'Purchase Log' })).toBeVisible({
      timeout: 10000,
    })

    // Click Stock — verify the Stock Overview page loads
    await stockBtn.click()
    await expect(page.locator('h1', { hasText: 'Stock Overview' })).toBeVisible({
      timeout: 10000,
    })
  })

  test('3.3: Pro tier reveals Simple Profit tab in Reports', async ({
    tierPage: page,
  }) => {
    // Capture browser console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type()}] ${msg.text()}`)
      }
    })

    // Switch to pro tier capabilities
    await reloadForCapabilities(page, 'pro')

    // Navigate to Reports
    const reportsBtn = page.locator('nav button', { hasText: 'Reports' })
    await expect(reportsBtn).toBeVisible({ timeout: 10000 })
    await reportsBtn.click()

    // Wait for ReportsManager to render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit from dropdown
    // Note: label is "Simple Profit" when pro is enabled, "Simple Profit (Pro)" when not
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Verify SimpleProfitReport renders
    await expect(page.locator('h3', { hasText: 'Profit Calculation' })).toBeVisible({
      timeout: 10000,
    })

    // Verify KPI cards are visible
    await expect(page.locator('text=Revenue').first()).toBeVisible()
    await expect(page.locator('text=Purchases').first()).toBeVisible()
    await expect(page.locator('text=Profit').first()).toBeVisible()
  })
})
