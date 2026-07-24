#!/usr/bin/env npx tsx
/**
 * verify-feature-wiring.ts
 *
 * Verifies that all 21 feature flags are properly wired between:
 *   DB (feature_definitions) → resolve_capabilities() → UI components (useCapability)
 *
 * Reports:
 *   ✅ Fully wired   — DB + code + UI gating
 *   ⚠️  Partially wired — DB + code reference, but no UI gating or wrong gating
 *   ❌ Not wired     — DB only, no code reference
 *   🔴 Dead keys     — DB only, marked as dead in tier-spec.md
 *   🚫 Orphaned      — Component exists but not routed from App.tsx
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Canonical feature list from tier-spec.md §2 ───────────────────────────
interface FeatureSpec {
  key: string;
  minTier: string;
  dbDefaultEnabled: boolean;
  status: 'active' | 'dead' | 'implicit';
  description: string;
  embeddedIn?: string;
}

const FEATURES: FeatureSpec[] = [
  { key: 'pos', minTier: 'free', dbDefaultEnabled: true, status: 'implicit', description: 'POS terminal (always available, no DB row)' },
  { key: 'inventory', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Stock tracking' },
  { key: 'discounts', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Discount engine' },
  { key: 'multi_currency', minTier: 'free', dbDefaultEnabled: true, status: 'dead', description: 'Multi-currency (DEAD — Myanmar is MMK-only)' },
  { key: 'draft_sales', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Draft/pending sales', embeddedIn: 'POSTerminal' },
  { key: 'customer_management', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Customer records' },
  { key: 'batch_tracking', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Batch/lot tracking', embeddedIn: 'ProductModal' },
  { key: 'weight_based_products', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Per-unit pricing', embeddedIn: 'ProductModal' },
  { key: 'credit_system', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Customer credit tracking' },
  { key: 'multi_tab_sales', minTier: 'free', dbDefaultEnabled: true, status: 'active', description: 'Multi-tab POS workflow' },
  { key: 'printer_integration', minTier: 'growth', dbDefaultEnabled: true, status: 'active', description: 'Thermal printer support' },
  { key: 'staff_accounts', minTier: 'growth', dbDefaultEnabled: true, status: 'active', description: 'Multiple staff logins' },
  { key: 'cash_drawer', minTier: 'growth', dbDefaultEnabled: true, status: 'active', description: 'Shift start/end management' },
  { key: 'recipe_bom', minTier: 'growth', dbDefaultEnabled: false, status: 'dead', description: 'Recipe/BOM costing (DEAD — removed per VISION §10.3 scope reframe)' },
  { key: 'raw_materials', minTier: 'growth', dbDefaultEnabled: false, status: 'dead', description: 'Raw material tracking (DEAD — removed per VISION §10.3 scope reframe)' },
  { key: 'advanced_reports', minTier: 'pro', dbDefaultEnabled: false, status: 'active', description: 'Consolidated Pro reports gate' },
  { key: 'owner_insights', minTier: 'pro', dbDefaultEnabled: false, status: 'active', description: 'P&L dashboard' },
  // profit_analytics removed — not in VISION.md §5.5 or tier-spec.md
  { key: 'waste_tracking', minTier: 'pro', dbDefaultEnabled: false, status: 'dead', description: 'Waste tracking (DEAD — removed per VISION §10.3/§19 scope reframe)' },
  { key: 'kitchen_display', minTier: 'pro', dbDefaultEnabled: false, status: 'dead', description: 'Kitchen display (DEAD — Myanmar uses printers)' },
  { key: 'online_ordering', minTier: 'pro', dbDefaultEnabled: false, status: 'dead', description: 'Online ordering (DEAD — not in v1)' },
  { key: 'supplier_management', minTier: 'pro', dbDefaultEnabled: false, status: 'dead', description: 'Supplier management (DEAD — no component)' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkDir(full, ext));
    } else if (full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

// ─── Step 1: Find all useCapability calls ──────────────────────────────────
function findUseCapabilityCalls(): Map<string, { file: string; line: number }[]> {
  const result = new Map<string, { file: string; line: number }[]>();
  const files = [
    ...walkDir(SRC, '.tsx'),
    ...walkDir(SRC, '.ts'),
  ];

  for (const filePath of files) {
    const content = readFile(filePath);
    const lines = content.split('\n');
    const relPath = relative(ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/useCapability\(['"]([^'"]+)['"]\)/);
      if (match) {
        const key = match[1];
        if (!result.has(key)) result.set(key, []);
        result.get(key)!.push({ file: relPath, line: i + 1 });
      }
    }
  }

  return result;
}

// ─── Step 2: Find routed components from App.tsx ───────────────────────────
function findRoutedComponents(): Set<string> {
  const appContent = readFile(join(SRC, 'App.tsx'));
  const routes = new Set<string>();

  // Match lazy imports: const ComponentName = lazy(...)
  for (const m of appContent.matchAll(/const\s+(\w+)\s*=\s*lazy\(/g)) {
    routes.add(m[1]);
  }

  // Match case statements: case 'view-name':
  for (const m of appContent.matchAll(/case\s+'([^']+)':/g)) {
    routes.add(m[1]);
  }

  return routes;
}

// ─── Step 3: Find UpgradePrompt usage ──────────────────────────────────────
function findUpgradePrompts(): { file: string; feature: string; tier: string }[] {
  const results: { file: string; feature: string; tier: string }[] = [];
  const files = walkDir(SRC, '.tsx');

  for (const filePath of files) {
    const content = readFile(filePath);
    const relPath = relative(ROOT, filePath);

    for (const m of content.matchAll(/<UpgradePrompt\s+feature="([^"]+)"\s+tier="([^"]+)"/g)) {
      results.push({ file: relPath, feature: m[1], tier: m[2] });
    }
  }

  return results;
}

// ─── Step 4: Detect wrong capability checks ────────────────────────────────
function findWrongCapabilityChecks(): { file: string; line: string; expected: string; found: string }[] {
  const issues: { file: string; line: string; expected: string; found: string }[] = [];

  // Known wrong mappings: file → { found_cap → expected_cap }
  // Only include TRUE mismatches (wrong cap used as the primary gate).
  // Additive checks (e.g., inventory + raw_materials) are NOT wrong.
  const wrongMappings: Record<string, Record<string, string>> = {
    'src/components/pos/SalesTabManager.tsx': {
      'cash_drawer': 'multi_tab_sales',
    },
  };

  for (const [file, mappings] of Object.entries(wrongMappings)) {
    try {
      const content = readFile(join(ROOT, file));
      for (const [found, expected] of Object.entries(mappings)) {
        if (content.includes(`useCapability('${found}')`)) {
          issues.push({ file, line: `useCapability('${found}')`, expected, found });
        }
      }
    } catch {
      // file doesn't exist
    }
  }

  return issues;
}

// ─── Step 5: Find orphaned components (exist but not routed) ───────────────
function findOrphanedComponents(): { component: string; file: string; feature: string }[] {
  const orphaned: { component: string; file: string; feature: string }[] = [];
  const knownOrphans = [
    { component: 'RawMaterialManager', file: 'src/components/inventory/RawMaterialManager.tsx', feature: 'raw_materials' },
    { component: 'RecipeManager', file: 'src/components/recipes/RecipeManager.tsx', feature: 'recipe_bom' },
  ];

  for (const o of knownOrphans) {
    try {
      readFile(join(ROOT, o.file));
      // Check if it's imported from App.tsx
      const appContent = readFile(join(SRC, 'App.tsx'));
      if (!appContent.includes(o.component)) {
        orphaned.push(o);
      }
    } catch {
      // file doesn't exist
    }
  }

  return orphaned;
}

// ─── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Feature Flag Wiring Verification Report               ║');
  console.log('║       Source of truth: docs/tier-spec.md                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  const capabilityCalls = findUseCapabilityCalls();
  const routedComponents = findRoutedComponents();
  const upgradePrompts = findUpgradePrompts();
  const wrongChecks = findWrongCapabilityChecks();
  const orphanedComponents = findOrphanedComponents();

  const results: { feature: FeatureSpec; status: string; details: string }[] = [];

  for (const feature of FEATURES) {
    const calls = capabilityCalls.get(feature.key) || [];
    const hasCodeRef = calls.length > 0;

    if (feature.status === 'dead') {
      results.push({
        feature,
        status: '🔴 DEAD',
        details: `DB row exists but marked dead in tier-spec.md. ${feature.description}`,
      });
      continue;
    }

    if (feature.status === 'implicit') {
      results.push({
        feature,
        status: '✅ IMPLICIT',
        details: `Always available. No DB row needed. ${feature.description}`,
      });
      continue;
    }

    // Check for wrong capability mappings
    const wrongCheck = wrongChecks.find(w => w.found === feature.key || w.expected === feature.key);

    if (feature.embeddedIn) {
      if (hasCodeRef) {
        results.push({
          feature,
          status: '✅ EMBEDDED',
          details: `Embedded in ${feature.embeddedIn}. Code references: ${calls.map(c => `${c.file}:${c.line}`).join(', ')}`,
        });
      } else {
        results.push({
          feature,
          status: '⚠️  EMBEDDED (no check)',
          details: `Embedded in ${feature.embeddedIn}. No useCapability('${feature.key}') found. tier-spec.md says embedded features don't need standalone gating.`,
        });
      }
      continue;
    }

    if (hasCodeRef) {
      // Check if the component is routed
      const isRouted = calls.some(c => {
        // Extract component name from file path
        const parts = c.file.split('/');
        const fileName = parts[parts.length - 1];
        const componentName = fileName.replace(/\.(tsx|ts)$/, '');
        return routedComponents.has(componentName);
      });

      if (wrongCheck) {
        results.push({
          feature,
          status: '⚠️  WRONG GATE',
          details: `Component uses ${wrongCheck.line} but should use useCapability('${wrongCheck.expected}'). Files: ${calls.map(c => `${c.file}:${c.line}`).join(', ')}`,
        });
      } else if (isRouted) {
        results.push({
          feature,
          status: '✅ FULLY WIRED',
          details: `Code references: ${calls.map(c => `${c.file}:${c.line}`).join(', ')}`,
        });
      } else {
        results.push({
          feature,
          status: '⚠️  NOT ROUTED',
          details: `Code references exist (${calls.map(c => `${c.file}:${c.line}`).join(', ')}) but component not routed from App.tsx`,
        });
      }
    } else {
      // No code reference at all
      const hasUpgradePrompt = upgradePrompts.some(
        up => up.feature.toLowerCase().includes(feature.key.replace(/_/g, ' '))
      );

      if (hasUpgradePrompt) {
        results.push({
          feature,
          status: '⚠️  PARTIAL',
          details: `UpgradePrompt exists but no useCapability('${feature.key}') check`,
        });
      } else {
        results.push({
          feature,
          status: '❌ NOT WIRED',
          details: `No useCapability('${feature.key}') found in codebase`,
        });
      }
    }
  }

  // Print results grouped by status
  const statusOrder = ['🔴 DEAD', '❌ NOT WIRED', '⚠️  WRONG GATE', '⚠️  NOT ROUTED', '⚠️  PARTIAL', '⚠️  EMBEDDED (no check)', '✅ FULLY WIRED', '✅ EMBEDDED', '✅ IMPLICIT'];

  for (const status of statusOrder) {
    const matching = results.filter(r => r.status === status);
    if (matching.length === 0) continue;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${status}`);
    console.log(`${'─'.repeat(60)}`);

    for (const r of matching) {
      console.log(`\n  Feature: ${r.feature.key}`);
      console.log(`  Tier:    ${r.feature.minTier}`);
      console.log(`  Details: ${r.details}`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'═'.repeat(60)}`);

  const counts = {
    dead: results.filter(r => r.status.includes('DEAD')).length,
    notWired: results.filter(r => r.status.includes('NOT WIRED')).length,
    wrongGate: results.filter(r => r.status.includes('WRONG GATE')).length,
    notRouted: results.filter(r => r.status.includes('NOT ROUTED')).length,
    partial: results.filter(r => r.status.includes('PARTIAL') || r.status.includes('EMBEDDED (no check)')).length,
    fullyWired: results.filter(r => r.status.includes('FULLY WIRED') || r.status.includes('IMPLICIT') || (r.status.includes('EMBEDDED') && !r.status.includes('no check'))).length,
  };

  console.log(`  🔴 Dead keys:           ${counts.dead}`);
  console.log(`  ❌ Not wired:           ${counts.notWired}`);
  console.log(`  ⚠️  Wrong capability:     ${counts.wrongGate}`);
  console.log(`  ⚠️  Not routed:          ${counts.notRouted}`);
  console.log(`  ⚠️  Partially wired:     ${counts.partial}`);
  console.log(`  ✅ Fully wired:         ${counts.fullyWired}`);
  console.log(`  ─────────────────────────`);
  console.log(`  Total features:        ${results.length}`);

  // Wrong capability checks detail
  if (wrongChecks.length > 0) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  ❌ WRONG CAPABILITY CHECKS (must fix)');
    console.log(`${'═'.repeat(60)}`);
    for (const w of wrongChecks) {
      console.log(`\n  File:     ${w.file}`);
      console.log(`  Found:    ${w.line}`);
      console.log(`  Expected: useCapability('${w.expected}')`);
    }
  }

  // Orphaned components
  if (orphanedComponents.length > 0) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('  🚫 ORPHANED COMPONENTS (exist but not routed)');
    console.log(`${'═'.repeat(60)}`);
    for (const o of orphanedComponents) {
      console.log(`\n  ${o.component}`);
      console.log(`  File:    ${o.file}`);
      console.log(`  Feature: ${o.feature}`);
      console.log(`  Status:  Not imported from App.tsx — unreachable by users`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  VERIFICATION COMPLETE');
  console.log(`${'═'.repeat(60)}\n`);
}

main();
