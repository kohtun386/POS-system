/**
 * Test User Helpers — Simplified for local dev
 *
 * Uses existing test-admin from seed.sql instead of creating new users.
 * This avoids RLS permission issues with service_role key.
 */
import { Page } from '@playwright/test'

// Pre-existing test credentials from seed.sql
export const TEST_ADMIN = {
  email: 'test-admin@coffeeshop.local',
  password: 'TestAdmin123!',
}

// Regular admin user (not platform_admin) — renders normal POS nav
export const TEST_ADMIN_MANAGER = {
  email: 'test-admin-manager@coffeeshop.local',
  password: 'TestAdmin123!',
}

/**
 * Login via the app's login page (for Playwright)
 */
export async function loginViaUI(page: Page, email?: string, password?: string) {
  const userEmail = email || TEST_ADMIN.email
  const userPassword = password || TEST_ADMIN.password

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Fill login form
  await page.fill('input[type="email"]', userEmail)
  await page.fill('input[type="password"]', userPassword)
  await page.click('button[type="submit"]')

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15000,
  })
}

/**
 * Signup a new user (for signup flow tests)
 */
export async function signupViaUI(
  page: Page,
  email: string,
  password: string,
  name: string,
  username: string,
) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Switch to signup mode if needed
  const signupToggle = page.locator('text=Sign up')
  if (await signupToggle.isVisible()) {
    await signupToggle.click()
  }

  // Fill signup form
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.fill('input[name="name"]', name)
  await page.fill('input[name="username"]', username)
  await page.click('button[type="submit"]')
}
