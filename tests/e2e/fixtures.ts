/**
 * E2E Test Fixtures — Simplified Playwright test setup
 *
 * Uses pre-existing test-admin user from seed.sql.
 * No DB cleanup needed — tests run against local dev data.
 */
import { test as base, expect } from '@playwright/test'
import { loginViaUI, TEST_ADMIN, TEST_ADMIN_MANAGER } from './helpers/test-users'
import { TIER_CAPABILITIES, Tier } from './helpers/tier-helpers'

type TestFixtures = {
  authenticatedPage: import('@playwright/test').Page
  /** Login with tier capability interception set up BEFORE navigation.
   *  This ensures the app sees the mocked capabilities on initial load.
   *  Set tier via: test.use({ metadata: { tier: 'growth' } }) */
  tierPage: import('@playwright/test').Page
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login with pre-existing test-admin user
    await loginViaUI(page, TEST_ADMIN.email, TEST_ADMIN.password)
    await use(page)
  },

  tierPage: async ({ page }, use) => {
    // Read tier from test metadata, default to 'free'
    const tier: Tier = (test.info().project.metadata?.tier as Tier) || 'free'

    // Set up route interception BEFORE any navigation
    const caps = TIER_CAPABILITIES[tier]
    await page.route('**/rest/v1/rpc/resolve_capabilities**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(caps),
      })
    })

    // Now login — the app will use our mocked capabilities on initial load
    await loginViaUI(page, TEST_ADMIN_MANAGER.email, TEST_ADMIN_MANAGER.password)
    await use(page)
  },
})

export { expect }
