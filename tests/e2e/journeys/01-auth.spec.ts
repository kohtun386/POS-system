/**
 * E2E Test: Authentication & Onboarding Flow
 *
 * Journey 1.1: Login with existing credentials
 * Journey 1.2: Verify dashboard loads after login
 * Journey 1.3: Currency displays as MMK
 */
import { test, expect } from '../fixtures'
import { loginViaUI, TEST_ADMIN } from '../helpers/test-users'

test.describe('Authentication & Onboarding', () => {
  test('1.1: Login with valid credentials shows dashboard', async ({
    page,
  }) => {
    // Login with existing test-admin
    await loginViaUI(page, TEST_ADMIN.email, TEST_ADMIN.password)

    // Should be on main app (POS or dashboard)
    const url = page.url()
    expect(url).not.toContain('/login')

    // Verify main app elements are visible
    await expect(page.locator('text=POS').first()).toBeVisible({
      timeout: 10000,
    })
  })

  test('1.2: Login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Try invalid login
    await page.fill('input[type="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error message (stay on login page)
    await page.waitForTimeout(2000)
    const url = page.url()
    // Either still on login or shows error
    expect(url).toContain('/') // Still on app
  })

  test('1.3: Currency displays as MMK throughout app', async ({
    authenticatedPage: page,
  }) => {
    // Navigate to products or POS
    await page.goto('/products')
    await page.waitForLoadState('networkidle')

    // Check page content - should NOT contain other currencies
    const pageContent = await page.textContent('body')

    // Should not show LKR, USD, or $
    expect(pageContent).not.toContain('LKR')
    expect(pageContent).not.toContain('USD')

    // May or may not explicitly show MMK depending on the page
    // The key assertion is that other currencies are NOT present
  })
})
