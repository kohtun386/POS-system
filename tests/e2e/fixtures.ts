/**
 * E2E Test Fixtures — Simplified Playwright test setup
 *
 * Uses pre-existing test-admin user from seed.sql.
 * No DB cleanup needed - tests run against local dev data.
 */
import { test as base, expect } from '@playwright/test'
import { loginViaUI, TEST_ADMIN } from './helpers/test-users'

type TestFixtures = {
  authenticatedPage: import('@playwright/test').Page
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login with pre-existing test-admin user
    await loginViaUI(page, TEST_ADMIN.email, TEST_ADMIN.password)
    await use(page)
  },
})

export { expect }
