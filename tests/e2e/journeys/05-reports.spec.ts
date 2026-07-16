/**
 * E2E Test: Simple Profit Report (Pro Tier)
 *
 * Journey 5.1: Navigate to Simple Profit Report
 * Journey 5.2: Verify the report calculates Profit = Revenue - Purchases
 *
 * Sets up pro-tier intercept BEFORE login so loadData() picks up
 * the correct capabilities from the start.
 */
import { test, expect } from '../fixtures'
import { setupTier, resetCapabilitiesIntercept } from '../helpers/tier-helpers'
import { loginViaUI, TEST_ADMIN_MANAGER } from '../helpers/test-users'

test.describe('Simple Profit Report', () => {
  test.afterEach(async ({ page }) => {
    await resetCapabilitiesIntercept(page)
  })

  test('5.1: Navigate to Simple Profit Report', async ({
    page,
  }) => {
    // Set up pro-tier intercept BEFORE login
    await setupTier(page, 'pro')
    await loginViaUI(page, TEST_ADMIN_MANAGER.email, TEST_ADMIN_MANAGER.password)
    await expect(page.locator('nav button', { hasText: 'Reports' })).toBeVisible({ timeout: 15000 })

    // Navigate to Reports
    await page.locator('nav button', { hasText: 'Reports' }).click()

    // Wait for ReportsManager
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit from dropdown
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Verify key elements
    await expect(page.locator('text=Revenue').first()).toBeVisible()
    await expect(page.locator('text=Purchases').first()).toBeVisible()
    await expect(page.locator('text=Net Profit')).toBeVisible()

    await expect(page.locator('h3', { hasText: 'Profit Calculation' })).toBeVisible()

    await expect(page.locator('text=Total Revenue')).toBeVisible()
    await expect(page.locator('text=Total Purchases')).toBeVisible()
    await expect(page.locator('text=Net Profit')).toBeVisible()
  })

  test('5.2: Verify Profit = Revenue - Purchases calculation', async ({
    page,
  }) => {
    await setupTier(page, 'pro')
    await loginViaUI(page, TEST_ADMIN_MANAGER.email, TEST_ADMIN_MANAGER.password)
    await expect(page.locator('nav button', { hasText: 'Reports' })).toBeVisible({ timeout: 15000 })

    // Navigate to Reports
    await page.locator('nav button', { hasText: 'Reports' }).click()

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Wait for data
    await page.waitForTimeout(2000)

    // Extract values — structure is div>span, not tr>td
    const revenueLabel = page.locator('text=Total Revenue')
    const purchasesLabel = page.locator('text=Total Purchases')
    const profitLabel = page.locator('text=Net Profit')

    await expect(revenueLabel).toBeVisible({ timeout: 10000 })
    await expect(purchasesLabel).toBeVisible()
    await expect(profitLabel).toBeVisible()

    // Values are in the sibling span within the same flex div
    const revenueText = await revenueLabel.locator('..').locator('span').last().innerText()
    const purchasesText = await purchasesLabel.locator('..').locator('span').last().innerText()
    const profitText = await profitLabel.locator('..').locator('span').last().innerText()

    const parseMMK = (s: string): number => {
      const cleaned = s.replace(/[^0-9-]/g, '')
      return parseInt(cleaned, 10) || 0
    }

    const revenue = parseMMK(revenueText)
    const purchases = parseMMK(purchasesText)
    const profit = parseMMK(profitText)

    expect(profit).toBe(revenue - purchases)

    if (revenue > 0) {
      const marginLabel = page.locator('text=Profit Margin')
      await expect(marginLabel).toBeVisible()
      const marginText = await marginLabel.locator('..').locator('span').last().innerText()
      expect(marginText).toMatch(/%/)
    }

    await expect(
      page.locator('text=Revenue - Purchases = Profit')
    ).toBeVisible()
  })
})
