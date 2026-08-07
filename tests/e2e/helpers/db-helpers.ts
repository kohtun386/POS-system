/**
 * E2E Test Helpers — Database Operations
 *
 * Uses Supabase REST API with service_role key (bypasses RLS) for
 * test data seeding and cleanup.
 *
 * NOTE: uses the test runner's global `fetch` (Node), NOT page.request.fetch.
 * The local Kong/PostgREST stack rejects page.request.fetch's apikey handling
 * with PGRST301 "None of the keys was able to decode the JWT" even for a valid
 * service_role JWT; plain fetch works (same as curl).
 */
import type { Page } from '@playwright/test'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function supabaseRequest(
  _page: Page,
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

  const response = await fetch(url, options)
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
  if (!response.ok) {
    const text = await response.text()
    console.warn(`Delete from ${table} failed: ${response.status} — ${text}`)
  }
}

/**
 * Fetch shop ids owned by the given user (for FK-order cleanup).
 */
export async function getShopIdsByOwner(
  page: Page,
  ownerId: string,
): Promise<string[]> {
  const res = await supabaseRequest(page, 'GET', 'shops', {
    select: 'id',
    owner_id: `eq.${ownerId}`,
  })
  if (!res.ok) {
    console.warn(`GET shops by owner failed: ${res.status} — ${await res.text()}`)
    return []
  }
  const rows = await res.json()
  return Array.isArray(rows) ? rows.map((r: { id: string }) => r.id) : []
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

/**
 * Poll the shops table (service-role, bypasses RLS) until the named shop
 * reaches the expected active state, or the timeout elapses.
 * Durable signal — independent of the success toast, which only lives ~3s
 * and can be missed when the Edge Function isolate is slow.
 */
export async function waitForShopActive(
  page: Page,
  shopName: string,
  expectedActive: boolean,
  timeoutMs = 30000,
): Promise<void> {
  const { expect } = await import('@playwright/test')
  const start = Date.now()
  let active: boolean | null = null
  while (Date.now() - start < timeoutMs) {
    const res = await supabaseRequest(page, 'GET', 'shops', {
      select: 'is_active',
      name: `eq.${shopName}`,
    })
    if (res.ok) {
      const rows = await res.json()
      active = rows.length > 0 ? Boolean(rows[0].is_active) : null
    }
    if (active === expectedActive) return
    await page.waitForTimeout(500)
  }
  throw new Error(
    `Timed out waiting for shop "${shopName}" is_active=${expectedActive} (last seen: ${active})`,
  )
}

/**
 * Poll the users table (service-role, bypasses RLS) until the user with the
 * given email reaches the expected active state, or the timeout elapses.
 * Durable signal that a rejection (or approval) has committed.
 */
export async function waitForUserActive(
  page: Page,
  email: string,
  expectedActive: boolean,
  timeoutMs = 30000,
): Promise<void> {
  const { expect } = await import('@playwright/test')
  const start = Date.now()
  let active: boolean | null = null
  while (Date.now() - start < timeoutMs) {
    const res = await supabaseRequest(page, 'GET', 'users', {
      select: 'active',
      email: `eq.${email}`,
    })
    if (res.ok) {
      const rows = await res.json()
      active = rows.length > 0 ? Boolean(rows[0].active) : null
    }
    if (active === expectedActive) return
    await page.waitForTimeout(500)
  }
  throw new Error(
    `Timed out waiting for user "${email}" active=${expectedActive} (last seen: ${active})`,
  )
}
