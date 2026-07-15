/**
 * E2E Test: Simplified Inventory (Growth+ Tier)
 *
 * Journey 4.1: Record a new supplier purchase via PurchaseLogModal
 * Journey 4.2: Verify the purchase appears in the PurchaseLogManager list
 * Journey 4.3: Perform a manual stock adjustment in StockOverviewManager
 *
 * Uses tierPage fixture which intercepts resolve_capabilities RPC
 * BEFORE login with growth-tier capabilities.
 */
import { test, expect } from '../fixtures'
import { setShopTier, reloadForCapabilities, resetCapabilitiesIntercept } from '../helpers/tier-helpers'
import { cleanupTestPurchases, cleanupTestStockItems, cleanupTestAdjustments } from '../helpers/db-helpers'

const TEST_SHOP_ID = process.env.TEST_SHOP_ID || '4f3dab19-144e-4a29-95a5-2ee82f160ce5'

test.describe('Simplified Inventory', () => {
  test.afterEach(async ({ page }) => {
    await resetCapabilitiesIntercept(page)
    await cleanupTestPurchases(page)
    await cleanupTestStockItems(page)
    await cleanupTestAdjustments(page)
  })

  test('4.1: Record a new supplier purchase via PurchaseLogModal', async ({
    tierPage: page,
  }) => {
    // Set growth tier capabilities (needed for purchase_log)
    setShopTier(page, TEST_SHOP_ID, 'growth')
    await reloadForCapabilities(page)

    // Navigate to Purchases
    const purchasesBtn = page.locator('nav button', { hasText: 'Purchases' })
    await expect(purchasesBtn).toBeVisible({ timeout: 10000 })
    await purchasesBtn.click()

    // Wait for Purchase Log page
    await expect(page.locator('h1', { hasText: 'Purchase Log' })).toBeVisible({
      timeout: 10000,
    })

    // Click "Record Purchase"
    const addBtn = page.locator('button', { hasText: 'Record Purchase' })
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    // Modal should appear
    const modal = page.locator('.modal-overlay .modal')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Fill form fields
    await modal.locator('input[type="text"]').first().fill('E2E Test Coffee Beans')
    await modal.locator('input[type="text"]').nth(1).fill('E2E Test Supplier')
    await modal.locator('input[type="number"]').first().fill('50')
    await modal.locator('select').first().selectOption('kg')
    await modal.locator('input[type="number"]').nth(1).fill('25000')

    // Verify computed total
    await expect(modal.locator('text=1,250,000')).toBeVisible({ timeout: 3000 })

    // Submit
    await modal.locator('button[type="submit"]').click()

    // Wait for modal to close
    await expect(modal).not.toBeVisible({ timeout: 10000 })
  })

  test('4.2: Verify the purchase appears in the PurchaseLogManager list', async ({
    tierPage: page,
  }) => {
    setShopTier(page, TEST_SHOP_ID, 'growth')
    await reloadForCapabilities(page)

    // Navigate to Purchases
    const purchasesBtn = page.locator('nav button', { hasText: 'Purchases' })
    await expect(purchasesBtn).toBeVisible({ timeout: 10000 })
    await purchasesBtn.click()

    await expect(page.locator('h1', { hasText: 'Purchase Log' })).toBeVisible({
      timeout: 10000,
    })

    // Search for test purchase
    const searchInput = page.locator('input[placeholder*="Search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('E2E Test Coffee Beans')
      await page.waitForTimeout(500)
    }

    // Verify row exists
    const row = page.locator('tr', { hasText: 'E2E Test Coffee Beans' })
    await expect(row).toBeVisible({ timeout: 5000 })

    // Verify key columns
    await expect(row.locator('td', { hasText: 'E2E Test Supplier' })).toBeVisible()
    await expect(row.locator('td', { hasText: /50/ })).toBeVisible()
  })

  test('4.3: Perform a manual stock adjustment in StockOverviewManager', async ({
    tierPage: page,
  }) => {
    setShopTier(page, TEST_SHOP_ID, 'growth')
    await reloadForCapabilities(page)

    // Navigate to Stock
    const stockBtn = page.locator('nav button', { hasText: 'Stock' })
    await expect(stockBtn).toBeVisible({ timeout: 10000 })
    await stockBtn.click()

    await expect(page.locator('h1', { hasText: 'Stock Overview' })).toBeVisible({
      timeout: 10000,
    })

    // Add a stock item
    const addItemBtn = page.locator('button', { hasText: 'Add Stock Item' })
    await expect(addItemBtn).toBeVisible()
    await addItemBtn.click()

    const addItemModal = page.locator('.modal-overlay .modal')
    await expect(addItemModal).toBeVisible({ timeout: 5000 })

    // Fill stock item form
    await addItemModal.locator('input[type="text"]').first().fill('E2E Test Milk')
    await addItemModal.locator('input[type="number"]').first().fill('100')
    await addItemModal.locator('select').first().selectOption('l')
    await addItemModal.locator('input[type="number"]').nth(1).fill('20')
    await addItemModal.locator('input[type="text"]').nth(1).fill('Dairy')

    // Submit
    await addItemModal.locator('button[type="submit"]').click()
    await expect(addItemModal).not.toBeVisible({ timeout: 5000 })

    // Find row and click Adjust
    const stockRow = page.locator('tr', { hasText: 'E2E Test Milk' })
    await expect(stockRow).toBeVisible({ timeout: 5000 })

    const adjustBtn = stockRow.locator('button[title="Adjust stock count"]')
    await expect(adjustBtn).toBeVisible()
    await adjustBtn.click()

    // AdjustModal
    const adjustModal = page.locator('.modal', { hasText: 'Adjust Stock' })
    await expect(adjustModal).toBeVisible({ timeout: 5000 })

    await expect(adjustModal.locator('text=Current count')).toBeVisible()

    await adjustModal.locator('input[type="number"]').first().fill('85')
    await adjustModal.locator('input[type="text"]').first().fill('E2E test adjustment — used 15L')

    await adjustModal.locator('button', { hasText: 'Confirm Adjustment' }).click()
    await expect(adjustModal).not.toBeVisible({ timeout: 5000 })

    // Verify updated quantity
    const updatedRow = page.locator('tr', { hasText: 'E2E Test Milk' })
    await expect(updatedRow).toBeVisible({ timeout: 5000 })
    await expect(updatedRow.locator('td', { hasText: /85/ })).toBeVisible({ timeout: 5000 })
  })
})
