/**
 * E2E Test: Simple Profit Report (Pro Tier)
 *
 * Journey 5.1: Navigate to Simple Profit Report
 * Journey 5.2: Verify the report calculates Profit = Revenue - Purchases
 *
 * Uses tierPage fixture with pro-tier capabilities intercepted before login.
 */
import { test, expect } from '../fixtures'
import { setShopTier, reloadForCapabilities, resetCapabilitiesIntercept } from '../helpers/tier-helpers'

const TEST_SHOP_ID = process.env.TEST_SHOP_ID || '4f3dab19-144e-4a29-95a5-2ee82f160ce5'

test.describe('Simple Profit Report', () => {
  test.afterEach(async ({ page }) => {
    await resetCapabilitiesIntercept(page)
  })

  test('5.1: Navigate to Simple Profit Report', async ({
    tierPage: page,
  }) => {
    // Set pro tier capabilities
    setShopTier(page, TEST_SHOP_ID, 'pro')
    await reloadForCapabilities(page)

    // Navigate to Reports
    const reportsBtn = page.locator('nav button', { hasText: 'Reports' })
    await expect(reportsBtn).toBeVisible({ timeout: 10000 })
    await reportsBtn.click()

    // Wait for ReportsManager
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit from dropdown
    // Note: label is "Simple Profit" when pro is enabled, "Simple Profit (Pro)" when not
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Verify key elements
    await expect(page.locator('text=Revenue').first()).toBeVisible()
    await expect(page.locator('text=Purchases').first()).toBeVisible()
    await expect(page.locator('text=Profit').first()).toBeVisible()

    await expect(page.locator('h3', { hasText: 'Profit Calculation' })).toBeVisible()

    await expect(page.locator('text=Total Revenue')).toBeVisible()
    await expect(page.locator('text=Total Purchases')).toBeVisible()
    await expect(page.locator('text=Net Profit')).toBeVisible()
  })

  test('5.2: Verify Profit = Revenue - Purchases calculation', async ({
    tierPage: page,
  }) => {
    setShopTier(page, TEST_SHOP_ID, 'pro')
    await reloadForCapabilities(page)

    // Navigate to Reports
    const reportsBtn = page.locator('nav button', { hasText: 'Reports' })
    await expect(reportsBtn).toBeVisible({ timeout: 10000 })
    await reportsBtn.click()

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Select Simple Profit
    const reportDropdown = page.locator('select').first()
    await reportDropdown.selectOption({ value: 'simple-profit' }, { timeout: 5000 })

    // Wait for data
    await page.waitForTimeout(2000)

    // Extract values
    const revenueRow = page.locator('tr', { hasText: 'Total Revenue' })
    const purchasesRow = page.locator('tr', { hasText: 'Total Purchases' })
    const profitRow = page.locator('tr', { hasText: 'Net Profit' })

    await expect(revenueRow).toBeVisible({ timeout: 10000 })
    await expect(purchasesRow).toBeVisible()
    await expect(profitRow).toBeVisible()

    const revenueText = await revenueRow.locator('td').last().innerText()
    const purchasesText = await purchasesRow.locator('td').last().innerText()
    const profitText = await profitRow.locator('td').last().innerText()

    const parseMMK = (s: string): number => {
      const cleaned = s.replace(/[^0-9-]/g, '')
      return parseInt(cleaned, 10) || 0
    }

    const revenue = parseMMK(revenueText)
    const purchases = parseMMK(purchasesText)
    const profit = parseMMK(profitText)

    expect(profit).toBe(revenue - purchases)

    if (revenue > 0) {
      const marginRow = page.locator('tr', { hasText: 'Profit Margin' })
      await expect(marginRow).toBeVisible()
      const marginText = await marginRow.locator('td').last().innerText()
      expect(marginText).toMatch(/%/)
    }

    await expect(
      page.locator('text=Revenue - Purchases = Profit')
    ).toBeVisible()
  })
})
