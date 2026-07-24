#!/usr/bin/env npx tsx
/**
 * validate-tiers.ts — CI validation script
 *
 * Parses docs/specs/tier-spec.md to extract expected tier assignments,
 * queries local Supabase feature_definitions, and fails on mismatch.
 *
 * Usage:
 *   npx tsx scripts/validate-tiers.ts
 *
 * Requires:
 *   SUPABASE_URL or VITE_SUPABASE_URL in environment
 *   SUPABASE_SERVICE_ROLE_KEY (recommended), or VITE_SUPABASE_ANON_KEY
 *   (reads from .env via dotenv if present)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file manually (Vite-style KEY=VALUE)
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
loadEnv(envDevPath) // .env.development overrides .env (Vite convention)

// ---------------------------------------------------------------------------
// 1. Parse tier-spec.md — extract feature_key → minTier from the table
// ---------------------------------------------------------------------------

interface ExpectedTier {
  key: string
  tier: string
}

function parseTierSpec(specPath: string): ExpectedTier[] {
  const content = readFileSync(specPath, 'utf-8')
  const lines = content.split('\n')
  const results: ExpectedTier[] = []

  // Match table rows like: | 2 | `inventory` | free | true | Stock tracking |
  // We capture the feature key (backtick-wrapped) and the tier (free/growth/pro)
  const rowRegex = /\|\s*\d+\s*\|\s*`([^`]+)`\s*\|\s*(?:\*\*)?(free|growth|pro)(?:\*\*)?\s*\|/

  for (const line of lines) {
    const match = line.match(rowRegex)
    if (match) {
      results.push({ key: match[1], tier: match[2] })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// 2. Query Supabase feature_definitions
// ---------------------------------------------------------------------------

interface ActualTier {
  key: string
  subscription_tier: string
  default_enabled: boolean
}

async function fetchFeatureDefinitions(): Promise<ActualTier[]> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  // Prefer service_role key for read-only validation (bypasses RLS)
  // Falls back to anon key — but RLS may block some queries
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials in environment.\n' +
      '  Tried URL: SUPABASE_URL, VITE_SUPABASE_URL\n' +
      '  Tried Key: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, SUPABASE_KEY\n' +
      '  Set them in .env, .env.development, or export manually.'
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('feature_definitions')
    .select('key, subscription_tier, default_enabled')

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`)
  }

  return (data || []) as ActualTier[]
}

// ---------------------------------------------------------------------------
// 3. Compare & report
// ---------------------------------------------------------------------------

interface Mismatch {
  key: string
  expected: string
  actual: string
  type: 'tier_mismatch' | 'missing_in_db' | 'dead_key_in_spec'
}

function compare(
  spec: ExpectedTier[],
  db: ActualTier[]
): { mismatches: Mismatch[]; warnings: string[] } {
  const mismatches: Mismatch[] = []
  const warnings: string[] = []

  // Dead keys — in DB but not in spec (expected, just note them)
  const specKeys = new Set(spec.map(s => s.key))
  const deadKeys = db.filter(d => !specKeys.has(d.key))

  for (const dk of deadKeys) {
    warnings.push(
      `ℹ️  Dead key in DB (not in tier-spec): "${dk.key}" — tier=${dk.subscription_tier}`
    )
  }

  // Check each spec entry against DB
  for (const expected of spec) {
    const dbRow = db.find(d => d.key === expected.key)

    if (!dbRow) {
      // Special case: `pos` is in VISION.md but not in feature_definitions (by design)
      if (expected.key === 'pos') {
        warnings.push(
          `ℹ️  Feature "${expected.key}" not in feature_definitions (always available by design)`
        )
        continue
      }

      mismatches.push({
        key: expected.key,
        expected: expected.tier,
        actual: '[missing]',
        type: 'missing_in_db',
      })
      continue
    }

    if (dbRow.subscription_tier !== expected.tier) {
      mismatches.push({
        key: expected.key,
        expected: expected.tier,
        actual: dbRow.subscription_tier,
        type: 'tier_mismatch',
      })
    }
  }

  return { mismatches, warnings }
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

async function main() {
  const specPath = resolve(__dirname, '../docs/specs/tier-spec.md')

  console.log('📋 Parsing tier-spec.md...')
  const spec = parseTierSpec(specPath)
  console.log(`   Found ${spec.length} feature entries in spec\n`)

  console.log('🗄️  Querying Supabase feature_definitions...')
  const db = await fetchFeatureDefinitions()
  console.log(`   Found ${db.length} rows in feature_definitions\n`)

  console.log('🔍 Comparing...\n')
  const { mismatches, warnings } = compare(spec, db)

  // Print warnings
  for (const w of warnings) {
    console.log(`  ${w}`)
  }
  if (warnings.length > 0) console.log('')

  // Print mismatches
  if (mismatches.length === 0) {
    console.log('✅ All feature tier assignments match tier-spec.md')
    process.exit(0)
  }

  console.log(`❌ ${mismatches.length} mismatch(es) found:\n`)
  console.log(
    '  Feature Key'.padEnd(30) +
    'Expected'.padEnd(15) +
    'Actual (DB)'.padEnd(15) +
    'Issue'
  )
  console.log('  ' + '─'.repeat(75))

  for (const m of mismatches) {
    const label =
      m.type === 'missing_in_db' ? 'NOT IN DB' : 'TIER MISMATCH'

    console.log(
      `  ${m.key.padEnd(28)} ` +
      `${m.expected.padEnd(13)} ` +
      `${m.actual.padEnd(13)} ` +
      label
    )
  }

  console.log('\n💡 Fix by running a Supabase migration to update feature_definitions.subscription_tier')
  console.log('   See docs/specs/tier-spec.md §2.1 for the canonical tier assignments.\n')

  process.exit(1)
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
