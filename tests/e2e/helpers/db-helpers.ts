/**
 * E2E Test Helpers — Database Operations
 *
 * Uses Supabase REST API with service_role key (bypasses RLS) for
 * test data seeding and cleanup.
 */
import { Page } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function supabaseRequest(
  page: Page,
  method: string,
  table: string,
  filter?: Record<string, string>,
  body?: Record<string, unknown>
) {
  const params = new URLSearchParams()
  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      params.append(key, value) // value already includes operator, e.g. "eq.uuid"
    }
  }
  const qs = params.toString() ? `?${params.toString()}` : ''
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'apikey': SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  }

  const options: RequestInit = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const response = await page.request.fetch(url, options)
  return response
}

/**
 * Delete rows from a table by filter. Uses service_role key (bypasses RLS).
 * Example: await deleteRows(page, 'purchase_logs', { item: 'eq.E2E Test Coffee Beans' })
 */
export async function deleteRows(
  page: Page,
  table: string,
  filter: Record<string, string>
) {
  const response = await supabaseRequest(page, 'DELETE', table, filter)
  if (!response.ok()) {
    const text = await response.text()
    console.warn(`Delete from ${table} failed: ${response.status()} — ${text}`)
  }
}

/**
 * Cleanup test purchases created during E2E tests.
 * Matches items prefixed with "E2E Test" to avoid deleting real data.
 */
export async function cleanupTestPurchases(page: Page) {
  await deleteRows(page, 'purchase_logs', { item: 'like.E2E Test%' })
}

/**
 * Cleanup test stock items created during E2E tests.
 */
export async function cleanupTestStockItems(page: Page) {
  await deleteRows(page, 'stock_items', { name: 'like.E2E Test%' })
}

/**
 * Cleanup test stock adjustments created during E2E tests.
 */
export async function cleanupTestAdjustments(page: Page) {
  // stock_adjustments don't have a name field — clean by reason prefix
  await deleteRows(page, 'stock_adjustments', { reason: 'like.E2E test%' })
}
