#!/usr/bin/env npx tsx
/**
 * check-schema-drift.ts — Schema Drift Detection Harness
 *
 * Detects mismatches between DB, docs (tier-spec.md, database.md), and code.
 * Reports severity levels (P0-P2) and generates JSON report.
 *
 * Usage:
 *   npx tsx scripts/check-schema-drift.ts
 *   npm run check:schema
 *
 * Requires:
 *   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment
 *   (reads from .env via manual loader if present)
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Environment loading (reused from validate-tiers.ts)
// ---------------------------------------------------------------------------

function loadEnv(envPath: string) {
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      process.env[key] = val
    }
  } catch {
    // .env not found — rely on existing env vars
  }
}

const envPath = resolve(__dirname, '../.env')
const envDevPath = resolve(__dirname, '../.env.development')
loadEnv(envPath)
loadEnv(envDevPath)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriftItem {
  severity: 'P0' | 'P1' | 'P2'
  check: string
  message: string
  details?: Record<string, unknown>
}

interface CheckResult {
  name: string
  severity: 'P0' | 'P1' | 'P2'
  status: 'clean' | 'drift'
  items: DriftItem[]
}

interface TierSpecEntry {
  key: string
  tier: string
  defaultEnabled: boolean
}

interface DbColumn {
  table_name: string
  column_name: string
  data_type: string
}

interface FeatureDefRow {
  key: string
  subscription_tier: string
  default_enabled: boolean
}

// ---------------------------------------------------------------------------
// 1. Parse tier-spec.md — extract key, tier, default_enabled from §2.1
// ---------------------------------------------------------------------------

function parseTierSpec(specPath: string): TierSpecEntry[] {
  const content = readFileSync(specPath, 'utf-8')
  const lines = content.split('\n')
  const results: TierSpecEntry[] = []

  // Match: | # | `key` | tier | default_enabled | description |
  const rowRegex = /\|\s*\d+\s*\|\s*`([^`]+)`\s*\|\s*(?:\*\*)?(free|growth|pro)(?:\*\*)?\s*\|\s*(true|false)\s*\|/

  for (const line of lines) {
    const match = line.match(rowRegex)
    if (match) {
      results.push({
        key: match[1],
        tier: match[2],
        defaultEnabled: match[3] === 'true',
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// 2. Parse tier-spec.md §2.2 — extract dead keys
// ---------------------------------------------------------------------------

function parseDeadKeys(specPath: string): string[] {
  const content = readFileSync(specPath, 'utf-8')
  const lines = content.split('\n')
  const deadKeys: string[] = []

  // Match dead key rows: | `key` | tier | **DEAD** | reason |
  const deadRegex = /\|\s*`([^`]+)`\s*\|\s*\w+\s*\|\s*\*\*DEAD\*\*/i

  for (const line of lines) {
    const match = line.match(deadRegex)
    if (match) {
      deadKeys.push(match[1])
    }
  }

  return deadKeys
}

// ---------------------------------------------------------------------------
// 3. Parse database.md — extract documented table names
// ---------------------------------------------------------------------------

// Tables documented as deprecated in database.md — excluded from P0 checks
const DEPRECATED_TABLES = new Set([
  'currency_config', 'exchange_rates', 'exchange_rate_history',
  'recipes', 'recipe_lines', 'recipe_items', 'raw_materials',
  'consumption_log', 'uom_conversions', 'kitchen_orders',
])

function parseDatabaseMd(dbPath: string): string[] {
  const content = readFileSync(dbPath, 'utf-8')
  const tables: string[] = []

  // Match both formats:
  // §1: #### `table_name`
  // §7: ### 7.1 `feature_definitions`  or  ### `shop_features`
  const tableRegex = /#{3,4}\s+(?:\d+\.\d+\s+)?`(\w+)`/g
  let match
  while ((match = tableRegex.exec(content)) !== null) {
    tables.push(match[1])
  }

  return tables
}

// ---------------------------------------------------------------------------
// 4. Supabase queries
// ---------------------------------------------------------------------------

function createSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  // Prefer service_role key for read-only validation (bypasses RLS)
  // Falls back to anon key — but RLS may block some queries
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials.\n' +
        '  Tried: VITE_SUPABASE_URL, SUPABASE_URL\n' +
        '  Tried: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, SUPABASE_KEY\n' +
        '  Set in .env, .env.development, or export manually.'
    )
  }

  return createClient(supabaseUrl, supabaseKey)
}

async function fetchFeatureDefinitions(client: ReturnType<typeof createClient>): Promise<FeatureDefRow[]> {
  const { data, error } = await client
    .from('feature_definitions')
    .select('key, subscription_tier, default_enabled')

  if (error) throw new Error(`feature_definitions query failed: ${error.message}`)
  return (data || []) as FeatureDefRow[]
}

async function fetchDbSchema(client: ReturnType<typeof createClient>): Promise<DbColumn[]> {
  const { data, error } = await client
    .rpc('get_schema_info')
    .select('*')

  // Fallback: query information_schema directly via raw SQL if RPC not available
  if (error) {
    // Use a simple approach: query each known table's columns
    const knownTables = [
      'app_settings', 'categories', 'products', 'product_batches',
      'customers', 'suppliers', 'discounts', 'users', 'sales',
      'sales_tabs', 'shops', 'shop_memberships', 'shop_features',
      'feature_definitions', 'print_jobs', 'cash_shifts',
      'alert_recipients', 'alert_templates', 'alert_configurations',
      'alert_history', 'notification_service_config',
      'purchase_logs', 'stock_items', 'stock_adjustments', 'audit_logs',
      'currency_config', 'exchange_rates', 'exchange_rate_history',
    ]

    const columns: DbColumn[] = []

    for (const table of knownTables) {
      const { data: cols } = await client
        .from(table as any)
        .select('*')
        .limit(0)

      // If query succeeds, table exists — get column info from first row structure
      if (cols !== null) {
        // We can't easily get column metadata via PostgREST
        // Instead, we'll count columns by checking the table's select behavior
        // This is a known limitation — we'll use the database.types.ts as fallback
      }
    }

    // Return empty — we'll use database.types.ts as primary schema source
    return []
  }

  return (data || []) as DbColumn[]
}

// ---------------------------------------------------------------------------
// 5. Parse database.types.ts — extract table schemas from TS types
// ---------------------------------------------------------------------------

function parseDatabaseTypes(typesPath: string): Record<string, string[]> {
  const content = readFileSync(typesPath, 'utf-8')
  const tables: Record<string, string[]> = {}

  // Match table definitions: table_name: { Row: { ... } }
  const tableBlockRegex = /(\w+):\s*\{\s*Row:\s*\{([^}]+)\}/g
  let match
  while ((match = tableBlockRegex.exec(content)) !== null) {
    const tableName = match[1]
    const rowBlock = match[2]

    // Extract column names from Row type
    const colRegex = /(\w+):/g
    const columns: string[] = []
    let colMatch
    while ((colMatch = colRegex.exec(rowBlock)) !== null) {
      // Skip type keywords
      const col = colMatch[1]
      if (!['Row', 'Insert', 'Update', 'Relationships'].includes(col)) {
        columns.push(col)
      }
    }

    if (columns.length > 0) {
      tables[tableName] = columns
    }
  }

  return tables
}

// ---------------------------------------------------------------------------
// 6. Drift Checks
// ---------------------------------------------------------------------------

function checkDefaultEnabledMismatch(
  spec: TierSpecEntry[],
  db: FeatureDefRow[]
): CheckResult {
  const items: DriftItem[] = []

  for (const entry of spec) {
    const dbRow = db.find((d) => d.key === entry.key)
    if (!dbRow) continue

    if (dbRow.default_enabled !== entry.defaultEnabled) {
      items.push({
        severity: 'P1',
        check: 'default_enabled_mismatch',
        message: `${entry.key}: tier-spec says ${entry.defaultEnabled}, DB has ${dbRow.default_enabled}`,
        details: {
          key: entry.key,
          expected: entry.defaultEnabled,
          actual: dbRow.default_enabled,
        },
      })
    }
  }

  return {
    name: 'default_enabled_mismatch',
    severity: 'P1',
    status: items.length > 0 ? 'drift' : 'clean',
    items,
  }
}

function checkDeadKeysInDb(deadKeys: string[], db: FeatureDefRow[]): CheckResult {
  const items: DriftItem[] = []

  for (const deadKey of deadKeys) {
    if (db.find((d) => d.key === deadKey)) {
      items.push({
        severity: 'P2',
        check: 'dead_key_in_db',
        message: `Dead key "${deadKey}" still exists in feature_definitions`,
        details: { key: deadKey },
      })
    }
  }

  return {
    name: 'dead_keys_in_db',
    severity: 'P2',
    status: items.length > 0 ? 'drift' : 'clean',
    items,
  }
}

function checkUndocumentedTables(
  documentedTables: string[],
  dbTables: string[]
): CheckResult {
  const items: DriftItem[] = []
  const documentedSet = new Set(documentedTables)

  for (const dbTable of dbTables) {
    // Skip deprecated tables — they're known but intentionally not actively used
    if (DEPRECATED_TABLES.has(dbTable)) continue

    if (!documentedSet.has(dbTable)) {
      items.push({
        severity: 'P2',
        check: 'undocumented_table',
        message: `Table "${dbTable}" exists in DB but not documented in database.md`,
        details: { table: dbTable },
      })
    }
  }

  return {
    name: 'undocumented_tables',
    severity: 'P2',
    status: items.length > 0 ? 'drift' : 'clean',
    items,
  }
}

function checkMissingTables(
  documentedTables: string[],
  dbTables: string[]
): CheckResult {
  const items: DriftItem[] = []
  const dbSet = new Set(dbTables)

  for (const docTable of documentedTables) {
    // Skip deprecated tables — they're documented but intentionally absent from DB
    if (DEPRECATED_TABLES.has(docTable)) continue

    if (!dbSet.has(docTable)) {
      items.push({
        severity: 'P0',
        check: 'missing_table',
        message: `Table "${docTable}" documented in database.md but not found in DB`,
        details: { table: docTable },
      })
    }
  }

  return {
    name: 'missing_tables',
    severity: 'P0',
    status: items.length > 0 ? 'drift' : 'clean',
    items,
  }
}

function checkColumnCountDrift(
  tsSchema: Record<string, string[]>,
  dbTables: string[]
): CheckResult {
  const items: DriftItem[] = []

  // We compare TS type column counts against a rough expectation
  // Tables with >2 column delta from TS types are flagged
  for (const [table, tsCols] of Object.entries(tsSchema)) {
    if (!dbTables.includes(table)) continue

    // Known column count expectations (from database.md §1)
    // This is a simplified check — flag tables where TS types have
    // significantly more columns than documented
    const expectedCounts: Record<string, number> = {
      shops: 20,
      sales: 23,
      products: 18,
      app_settings: 17,
    }

    const expected = expectedCounts[table]
    if (expected && tsCols.length > expected + 2) {
      items.push({
        severity: 'P2',
        check: 'column_count_drift',
        message: `${table}: TS types have ${tsCols.length} columns, documented ~${expected}`,
        details: {
          table,
          tsColumns: tsCols.length,
          documentedEstimate: expected,
        },
      })
    }
  }

  return {
    name: 'column_count_drift',
    severity: 'P2',
    status: items.length > 0 ? 'drift' : 'clean',
    items,
  }
}

// ---------------------------------------------------------------------------
// 7. Report generation
// ---------------------------------------------------------------------------

function generateReport(results: CheckResult[], timestamp: string) {
  const summary = { p0: 0, p1: 0, p2: 0, total: 0 }

  for (const r of results) {
    if (r.status === 'drift') {
      const count = r.items.length
      summary.total += count
      if (r.severity === 'P0') summary.p0 += count
      else if (r.severity === 'P1') summary.p1 += count
      else summary.p2 += count
    }
  }

  return {
    timestamp,
    summary,
    checks: results.map((r) => ({
      name: r.name,
      severity: r.severity,
      status: r.status,
      itemCount: r.items.length,
      items: r.items,
    })),
  }
}

// ---------------------------------------------------------------------------
// 8. Main
// ---------------------------------------------------------------------------

async function main() {
  const timestamp = new Date().toISOString()

  console.log('📋 Schema Drift Report')
  console.log('═══════════════════════\n')

  // --- Parse docs ---
  const tierSpecPath = resolve(__dirname, '../docs/specs/tier-spec.md')
  const databaseMdPath = resolve(__dirname, '../docs/architecture/database.md')
  const databaseTypesPath = resolve(__dirname, '../src/lib/database.types.ts')

  console.log('📖 Parsing tier-spec.md...')
  const tierSpec = parseTierSpec(tierSpecPath)
  const deadKeys = parseDeadKeys(tierSpecPath)
  console.log(`   Found ${tierSpec.length} active features, ${deadKeys.length} dead keys\n`)

  console.log('📖 Parsing database.md...')
  const documentedTables = parseDatabaseMd(databaseMdPath)
  console.log(`   Found ${documentedTables.length} documented tables\n`)

  console.log('📖 Parsing database.types.ts...')
  const tsSchema = parseDatabaseTypes(databaseTypesPath)
  console.log(`   Found ${Object.keys(tsSchema).length} TS table definitions\n`)

  // --- Query DB ---
  console.log('🗄️  Connecting to Supabase...')
  const client = createSupabaseClient()

  console.log('   Querying feature_definitions...')
  const featureDefs = await fetchFeatureDefinitions(client)
  console.log(`   Found ${featureDefs.length} feature definitions\n`)

  // Get table list from TS types (since we can't query information_schema directly)
  const dbTables = Object.keys(tsSchema)

  // --- Run checks ---
  console.log('🔍 Running drift checks...\n')

  const results: CheckResult[] = [
    checkDefaultEnabledMismatch(tierSpec, featureDefs),
    checkDeadKeysInDb(deadKeys, featureDefs),
    checkUndocumentedTables(documentedTables, dbTables),
    checkMissingTables(documentedTables, dbTables),
    checkColumnCountDrift(tsSchema, dbTables),
  ]

  // --- Output ---
  for (const r of results) {
    const icon = r.status === 'clean' ? '✅' : '⚠️'
    const label = r.severity

    if (r.status === 'clean') {
      console.log(`${icon} ${r.name} (${label}) — clean`)
    } else {
      console.log(`${icon} ${r.name} (${label}) — ${r.items.length} issue(s)`)
      for (const item of r.items.slice(0, 5)) {
        console.log(`   ${item.message}`)
      }
      if (r.items.length > 5) {
        console.log(`   ... and ${r.items.length - 5} more`)
      }
    }
    console.log('')
  }

  // --- Write JSON report ---
  const report = generateReport(results, timestamp)
  const reportPath = resolve(__dirname, '../schema-drift-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`📄 Report written to schema-drift-report.json`)

  // --- Summary ---
  console.log('\n═══════════════════════')
  console.log(
    `Summary: ${report.summary.p0} P0, ${report.summary.p1} P1, ${report.summary.p2} P2 — ${report.summary.total} total`
  )

  // --- Exit code ---
  if (report.summary.p0 > 0) {
    console.log('\n❌ P0 drift detected — fix before committing')
    process.exit(1)
  } else if (report.summary.total > 0) {
    console.log('\n⚠️  Drift detected (non-blocking) — review recommended')
    process.exit(0)
  } else {
    console.log('\n✅ No drift detected')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
