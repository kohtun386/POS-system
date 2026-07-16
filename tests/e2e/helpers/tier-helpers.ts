/**
 * E2E Test Helpers — Tier Switching
 *
 * Controls feature gating by intercepting the resolve_capabilities RPC
 * or directly setting app state capabilities. This avoids Edge Function
 * DNS issues and service_role grant limitations in local Supabase.
 *
 * Capabilities control which nav tabs and features are visible.
 * The tier itself only matters for resolve_capabilities() server-side —
 * for E2E we mock the resolved result directly.
 */
import { Page, expect } from '@playwright/test'

export type Tier = 'free' | 'growth' | 'pro'

/** Capability sets per tier — matches tier-spec.md §2.1 */
export const TIER_CAPABILITIES: Record<Tier, string[]> = {
  free: [
    'pos', 'inventory', 'discounts', 'draft_sales', 'customer_management',
    'batch_tracking', 'weight_based_products', 'credit_system', 'multi_tab_sales',
  ],
  growth: [
    'pos', 'inventory', 'discounts', 'draft_sales', 'customer_management',
    'batch_tracking', 'weight_based_products', 'credit_system', 'multi_tab_sales',
    'printer_integration', 'staff_accounts', 'cash_drawer',
    'purchase_log', 'stock_overview', 'low_stock_alerts',
  ],
  pro: [
    'pos', 'inventory', 'discounts', 'draft_sales', 'customer_management',
    'batch_tracking', 'weight_based_products', 'credit_system', 'multi_tab_sales',
    'printer_integration', 'staff_accounts', 'cash_drawer',
    'purchase_log', 'stock_overview', 'low_stock_alerts',
    'advanced_reports', 'owner_insights', 'simple_profit_report',
  ],
}

/**
 * Set up route interception to mock resolve_capabilities RPC response.
 * Safe to call multiple times — page.route() stacks handlers, last wins.
 * After interception, use reloadForCapabilities() to apply.
 */
export async function interceptCapabilities(page: Page, tier: Tier) {
  // Log all requests to help debug interception issues
  page.on('request', (req) => {
    if (req.url().includes('resolve_capabilities')) {
      console.log(`[INTERCEPT] Request to: ${req.url()} method: ${req.method()}`)
    }
  })

  await page.route('**/rest/v1/rpc/resolve_capabilities**', async (route) => {
    console.log(`[INTERCEPT] Intercepted resolve_capabilities for tier: ${tier}`)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TIER_CAPABILITIES[tier]),
    })
  })
}

/**
 * Change intercepted tier capabilities.
 * After calling this, use reloadForCapabilities() to dispatch the new caps.
 */
export async function setShopTier(page: Page, _shopId: string, tier: Tier) {
  // Remove old route and intercept with new tier
  await page.unroute('**/rest/v1/rpc/resolve_capabilities**')
  await page.route('**/rest/v1/rpc/resolve_capabilities**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TIER_CAPABILITIES[tier]),
    })
  })
}

/**
 * Reset the route interception — call in afterAll to clean up.
 */
export async function resetCapabilitiesIntercept(page: Page) {
  try {
    await page.unroute('**/rest/v1/rpc/resolve_capabilities**')
  } catch { /* already unregistered */ }
}

/**
 * Apply tier capabilities by dispatching SET_CAPABILITIES directly
 * into the React app state via the global __appDispatch exposed by
 * SupabaseAppContext for E2E testing.
 */
export async function applyCapabilities(page: Page, tier: Tier) {
  const caps = TIER_CAPABILITIES[tier]

  const result = await page.evaluate((capabilities) => {
    const dispatch = (window as any).__appDispatch
    if (!dispatch) return 'no __appDispatch found'
    dispatch({ type: 'SET_CAPABILITIES', payload: capabilities })
    return 'dispatched'
  }, caps)

  console.log(`[APPLY_CAPS] tier=${tier}, result=${result}`)
  // Wait for React to re-render
  await page.waitForTimeout(500)
}

/**
 * Wait for the initial data load to complete.
 * loadData() is async — it calls Promise.all for data, then resolveCapabilitiesRpc().
 * We wait for the POS nav to render, then dispatch the test's tier caps.
 * The dispatch must happen AFTER loadData's resolveCapabilitiesRpc completes,
 * otherwise it gets overwritten. We detect this by waiting for product content
 * to appear (last data dispatch) + generous buffer for the RPC call.
 */
export async function waitForInitialLoad(page: Page) {
  // Wait for the POS page to be fully loaded (nav + products visible)
  await expect(page.locator('nav button', { hasText: 'POS' })).toBeVisible({ timeout: 15000 })
  // Wait for product content to appear (= data fully loaded)
  await page.waitForTimeout(3000)
}

/**
 * Set up tier intercept BEFORE login so loadData() picks up the correct tier.
 * Call this instead of relying on reloadForCapabilities for initial tier setup.
 * Usage: call setupTier(page, 'growth') before loginViaUI in the test.
 */
export async function setupTier(page: Page, tier: Tier) {
  await page.route('**/rest/v1/rpc/resolve_capabilities**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TIER_CAPABILITIES[tier]),
    })
  })
}

/**
 * Reload capabilities after a tier change.
 */
export async function reloadForCapabilities(page: Page, tier: Tier = 'free') {
  await applyCapabilities(page, tier)
}
