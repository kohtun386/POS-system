# Pre-Database-Fix Codebase Scan

**Date:** 2026-07-14
**Status:** SCAN COMPLETE
**VISION.md Version:** v3.1.0
**Branch:** feature/scope-reframe-v4

> **Authority:** This scan is read-only analysis. No files were modified.
> Document precedence: VISION.md v3.1.0 (SSOT) > tier-spec.md > CLAUDE.md

---

## Executive Summary

| Metric | Count | Priority |
|--------|-------|----------|
| **Capability key usages in code** | 13 active checks across 9 components | — |
| **Dead key references in `src/`** | 0 (none in active code) | — |
| **Dead key rows in DB** | 4 | P0 |
| **Missing capability keys in DB** | 7 | P0 |
| **Dead tables in DB schema** | 6 | P2 |
| **Dead columns in live tables** | 6 | P2 |
| **Required migrations** | 3 | — |
| **Required code changes** | 9 (5 P0/P1, 4 P2+) | — |
| **Critical bugs found** | 2 | P0 |

**Key findings:**
1. `useCapability()` hook exists and is used correctly — no direct `subscriptionTier` gating in shop-facing components
2. 4 dead capability keys actively seeded in `feature_definitions` DB table
3. 7 valid capability keys missing from `feature_definitions` — capability resolution will never grant them
4. **Breaking bug:** `state.settings.currency` always returns `'LKR'` (Sri Lankan Rupee) instead of `'MMK'` in 20+ display sites
5. `print_jobs` table referenced by `services.ts` but does not exist in the DB

---

## Phase 1: Capability Keys Usage Analysis

### 1.1 `useCapability()` Hook — Status: EXISTS ✓

**Location:** `src/context/SupabaseAppContext.tsx:443-446`

```typescript
export function useCapability(name: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(name);
}
```

Implementation is correct. Hook is exported and used in 9 components.

---

### 1.2 Capability Key Usage Table

| Capability Key | Tier | Used in Code? | Components Checking It | Lines |
|---------------|------|--------------|------------------------|-------|
| `pos` | free | **NO** | None — only in `initialState.capabilities: ['pos']` default | — |
| `inventory` | free | ✅ YES | `src/App.tsx`, `src/components/layout/Header.tsx` | 27, 20 |
| `discounts` | free | ✅ YES | `src/App.tsx`, `src/components/layout/Header.tsx` | 29, 22 |
| `draft_sales` | free | **NO** | — | — |
| `customer_management` | free | ✅ YES | `src/App.tsx`, `src/components/layout/Header.tsx` | 28, 21 |
| `batch_tracking` | free | **NO** | — | — |
| `weight_based_products` | free | **NO** | — | — |
| `credit_system` | free | ✅ YES | `src/components/pos/CheckoutModal.tsx` | 22 |
| `multi_tab_sales` | free | ✅ YES | `src/components/pos/SalesTabManager.tsx` | 12 |
| `printer_integration` | growth | ✅ YES | `src/components/pos/ReceiptPrint.tsx`, `src/components/settings/Settings.tsx`, `src/components/transactions/TransactionsManager.tsx` | 165, 30, 349 |
| `purchase_log` | growth | **NO** | — | — |
| `stock_overview` | growth | **NO** | — | — |
| `low_stock_alerts` | growth | **NO** | — | — |
| `staff_accounts` | growth | ✅ YES | `src/components/users/UserManager.tsx` | 12 |
| `cash_drawer` | growth | **NO** | — | — |
| `owner_insights` | pro | **NO** | — | — |
| `simple_profit_report` | pro | **NO** | — | — |
| `advanced_reports` | pro | ✅ YES | `src/components/reports/ReportsManager.tsx` | 13 |

**Summary:** 9 of 18 valid capability keys are actively used. 9 are unused but this may be intentional (features render unconditionally).

---

### 1.3 Direct `subscriptionTier` Checks (Violations)

**Verdict: 0 violations in shop-facing components.** All references are legitimate:

| File | Line | Usage | Justification |
|------|-------|-------|---------------|
| `src/components/platform/SubscriptionManager.tsx` | 27, 61, 68-70 | Platform admin tier-switcher UI | ✅ Correct — this IS the admin panel for tier management |
| `src/lib/services.ts` | 100, 121 | `resolveCapabilities()` — server-side capability resolution | ✅ Correct — this is how capabilities are resolved |
| `src/components/pos/CheckoutModal.tsx` | 871 | Passes `tier` prop to `UpgradePrompt` | ✅ Correct — shows which tier a feature requires |
| `src/lib/services.ts` | 70, 1477, 1731 | DB ↔ TypeScript type mapping | ✅ Correct — data transformation, not gating |

---

### 1.4 Dead Capability Keys in Code

**Verdict: NONE in `src/` active code.**

Dead keys searched: `profit_analytics`, `recipe_bom`, `raw_materials`, `waste_tracking`, `kitchen_display`, `online_ordering`, `supplier_management`, `multi_currency`

Zero matches in application code. Only auto-generated types in `src/lib/database.types.ts` (from DB schema) reference some dead tables/columns.

---

### 1.5 Documentation Discrepancy: `profit_analytics`

**FINDING:** `profit_analytics` appears in `docs/specs/tier-spec.md` line 44 (entry #19) and `docs/specs/feature-gating.md` lines 113, 491, but **does NOT appear in VISION.md §5.5**.

- VISION.md v3.1.0 defines **18 capability keys**
- tier-spec.md lists **19 keys** (includes `profit_analytics`)
- This creates a 18-vs-19 mismatch

**Action needed:** Resolve this discrepancy before any capability changes. Either:
1. Add `profit_analytics` to VISION.md §5.5 (making it a 19th valid key), OR
2. Remove `profit_analytics` from tier-spec.md and feature-gating.md

---

## Phase 2: Dead Features Code Analysis

### 2.1 Dead Feature Reference Table

| Feature | Dead? | `src/` Active Code | DB Seed (`feature_definitions`) | `database.types.ts` | Docs | Recommended Action |
|---------|-------|-------------------|-------------------------------|-------------------|------|-------------------|
| **multi_currency** | ✅ | NONE | `20260624000001_feature_flags.sql:105` — DEAD row present | Auto-gen (3 tables: currency_config, exchange_rates, exchange_rate_history + 3 settings columns) | All correctly annotated | DELETE DB row; DROP tables/columns later |
| **recipe_bom** | ✅ | NONE | NOT seeded | Auto-gen (recipes, recipe_lines, raw_materials, consumption_log tables) | All correctly annotated | DROP tables later |
| **kitchen_display** | ✅ | NONE | `20260624000001_feature_flags.sql:108` — DEAD row present | Auto-gen (kitchen_orders table) | All correctly annotated | DELETE DB row; DROP table later |
| **waste_tracking** | ✅ | NONE | NOT seeded | NONE | All correctly annotated | CLEAN — no action needed |
| **online_ordering** | ✅ | NONE | `20260624000001_feature_flags.sql:109` — DEAD row present | NONE | All correctly annotated | DELETE DB row |
| **supplier_management** | ✅ | NONE | `20260624000001_feature_flags.sql:111` — DEAD row present | NONE | All correctly annotated | DELETE DB row |
| **profit_analytics** | ⚠️ | NONE | NOT seeded | NONE | **DISCREPANCY** — in tier-spec.md but not VISION.md | RESOLVE DISCREPANCY first |

### 2.2 Dead Feature Code Details

**`src/lib/database.types.ts`** (auto-generated — DO NOT EDIT MANUALLY):
- Lines 554-587: `currency_config` table type
- Lines 725-814: `exchange_rates`, `exchange_rate_history` table types
- Lines 855-970: `kitchen_orders` table type
- Lines 1122-1294: `raw_materials`, `recipe_lines`, `recipes` table types
- Lines 1604-1643: `suppliers` table type
- Lines 305-307: `exchange_rate_api_key`, `exchange_rate_provider`, `exchange_rate_update_interval` columns on `app_settings`

> **Note:** These auto-generated types will disappear automatically once corresponding DB objects are dropped. No manual editing needed.

**`src/components/inventory/ProductModal.tsx:258`** — Sets `supplierInfo: ''` when creating a product batch. Dead field mapping.

**`src/components/pos/CheckoutModal.tsx:359`** — Stale comment: `"// Atomic checkout via RPC (handles sale, invoice, kitchen orders, stock deduction, customer update)"`. `kitchen_orders` reference is dead.

**`src/lib/services.ts:9, 200, 239, 289, 344`** — `supplier_info`/`supplierInfo` mapping in product batch CRUD. Dead field.

**`src/lib/services.ts:1753`** — `currency` field in `PlatformDailyStats` interface. Dead field.

---

### 2.3 🔴 CRITICAL BUG: Wrong Currency Display

**File:** `src/context/SupabaseAppContext.tsx:97`

```typescript
// CURRENT (BROKEN):
settings: {
  currency: 'LKR',  // ← WRONG! LKR = Sri Lankan Rupee, not MMK
  ...
}
```

**Impact:** `state.settings.currency` returns `'LKR'` in 20+ display sites across:
- `Cart.tsx` — price display
- `CheckoutModal.tsx` — total display
- `TransactionsManager.tsx` — transaction totals
- `ReceiptPrint.tsx` — receipt display
- `ProductGrid.tsx` — product prices
- `DiscountManager.tsx` — discount amounts
- `InventoryManager.tsx` — stock values
- `ReportsManager.tsx` — report figures

**Root cause chain:**
1. `AppSettings` type (types/index.ts:185-198) has **NO** `currency` field
2. `initialState.settings.currency = 'LKR'` sets wrong value (Sri Lanka, not Myanmar)
3. `settingsService.get()` (services.ts:743-766) does NOT map `currency` from DB
4. `app_settings.currency` DB column defaults to `'USD'` — also wrong

**Fix:** Since MMK is hardcoded (VISION.md §19 — MMK only), currency should be a constant, not a setting. Remove `state.settings.currency` entirely and use a hardcoded `'MMK'` constant everywhere.

---

## Phase 3: Database Migration Requirements

### 3.1 Current DB State

From live Supabase DB `feature_definitions` table — **15 rows**:

| Key | Category | Min Tier | Status |
|-----|----------|----------|--------|
| `credit_system` | customers | free | ✅ VALID |
| `customer_management` | customers | free | ✅ VALID |
| `advanced_reports` | general | pro | ✅ VALID |
| `multi_currency` | general | free | 🔴 DEAD |
| `staff_accounts` | general | growth | ✅ VALID |
| `batch_tracking` | inventory | free | ✅ VALID |
| `inventory` | inventory | free | ✅ VALID |
| `supplier_management` | inventory | pro | 🔴 DEAD |
| `weight_based_products` | inventory | free | ✅ VALID |
| `kitchen_display` | kitchen | pro | 🔴 DEAD |
| `discounts` | pos | free | ✅ VALID |
| `draft_sales` | pos | free | ✅ VALID |
| `multi_tab_sales` | pos | free | ✅ VALID |
| `online_ordering` | pos | pro | 🔴 DEAD |
| `printer_integration` | pos | growth | ✅ VALID |

### 3.2 Gap Analysis

**User prompt listed 12 missing keys, but 5 already exist:** `batch_tracking`, `weight_based_products`, `credit_system`, `multi_tab_sales`, `advanced_reports` are already in the DB.

**Actually missing (7):**

| Key | Tier | VISION.md §5.5 Reference |
|-----|------|-------------------------|
| `pos` | free | §5.5 — POS terminal |
| `purchase_log` | growth | §5.5 — Purchase Log |
| `stock_overview` | growth | §5.5 — Stock Overview |
| `low_stock_alerts` | growth | §5.5 — Low Stock Alerts |
| `cash_drawer` | growth | §5.5 — Cash Drawer / Shift Mgmt |
| `owner_insights` | pro | §5.5 — Owner Insights (P&L) |
| `simple_profit_report` | pro | §5.5 — Simple Profit Report |

**Dead keys to remove (4):**

| Key | Reason | VISION.md §19 Reference |
|-----|--------|------------------------|
| `multi_currency` | MMK-only policy | §19 — explicitly out of scope |
| `kitchen_display` | Thermal printer only | §19 — explicitly out of scope |
| `online_ordering` | v2 only | §19 — explicitly out of scope |
| `supplier_management` | v2 only | §19 — explicitly out of scope |

### 3.3 `print_jobs` Table Status

**NOT in DB.** `services.ts:1534-1605` has full CRUD for `printJobsService` targeting `print_jobs`, but the table doesn't exist. Type definitions exist in `database.types.ts` (stale). This table is needed for Growth+ printer integration.

---

### 3.4 Draft Migration SQL

#### Migration 1: `supabase/migrations/20260714050000_remove_dead_capability_keys.sql`

```sql
-- ================================================================
-- Migration: Remove Dead Capability Keys
-- Date: July 14, 2026
-- Description:
--   Removes 4 capability keys that are explicitly out of scope
--   per VISION.md §19 "What We Are NOT Building".
--
--   Removed:
--   - multi_currency (MMK-only policy, §19)
--   - kitchen_display (thermal printer only, §19)
--   - online_ordering (out of scope, §19)
--   - supplier_management (out of scope, §19)
-- ================================================================

-- Remove shop overrides for dead keys first (FK dependency)
DELETE FROM shop_features
WHERE feature_key IN (
  'multi_currency',
  'kitchen_display',
  'online_ordering',
  'supplier_management'
);

-- Remove dead feature definitions
DELETE FROM feature_definitions
WHERE key IN (
  'multi_currency',
  'kitchen_display',
  'online_ordering',
  'supplier_management'
);

-- ================================================================
-- VERIFICATION:
-- SELECT key FROM feature_definitions
-- WHERE key IN ('multi_currency', 'kitchen_display', 'online_ordering', 'supplier_management');
-- Expected: 0 rows
-- SELECT COUNT(*) FROM feature_definitions;
-- Expected: 11 rows
-- ================================================================
```

#### Migration 2: `supabase/migrations/20260714050001_seed_missing_capability_keys.sql`

```sql
-- ================================================================
-- Migration: Seed Missing Capability Keys
-- Date: July 14, 2026
-- Description:
--   Inserts 7 missing capability keys from VISION.md §5.5
--   to bring feature_definitions to the full 18-key set.
-- ================================================================

-- Free tier
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'pos', 'POS Terminal', 'Point-of-sale terminal functionality', 'pos', true, 'free'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'pos');

-- Growth tier
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'purchase_log', 'Purchase Log', 'Record supplier purchases and stock intake', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'purchase_log');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'stock_overview', 'Stock Overview', 'View stock levels and make adjustments', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'stock_overview');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'low_stock_alerts', 'Low Stock Alerts', 'Threshold-based stock level alerts', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'low_stock_alerts');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'cash_drawer', 'Cash Drawer', 'Cash shift start and end management', 'pos', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'cash_drawer');

-- Pro tier
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'owner_insights', 'Owner Insights', 'Profit & loss dashboard for shop owners', 'reports', true, 'pro'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'owner_insights');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'simple_profit_report', 'Simple Profit Report', 'Revenue minus purchases summary', 'reports', true, 'pro'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'simple_profit_report');

-- ================================================================
-- VERIFICATION:
-- SELECT key, subscription_tier FROM feature_definitions
-- ORDER BY CASE subscription_tier WHEN 'free' THEN 0 WHEN 'growth' THEN 1 WHEN 'pro' THEN 2 END, key;
-- Expected: 18 rows
-- ================================================================
```

#### Migration 3: `supabase/migrations/20260714050002_create_print_jobs_table.sql`

```sql
-- ================================================================
-- Migration: Create print_jobs Table
-- Date: July 14, 2026
-- Description:
--   Creates the print_jobs table for thermal printer integration
--   (Growth+ tier). Referenced by printJobsService in services.ts.
--
--   VISION.md §5.5: printer_integration requires Growth tier.
--   Columns derived from services.ts lines 1534-1605.
-- ================================================================

-- ================================================================
-- 1. TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS print_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES sales(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'printing', 'completed', 'failed')),
  config_data  JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ================================================================
-- 2. INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id    ON print_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status     ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order_id   ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_status ON print_jobs(shop_id, status);

-- ================================================================
-- 3. RLS POLICIES (following existing migration patterns)
-- ================================================================

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Shop members can view print jobs for their shop
CREATE POLICY "Print jobs viewable by shop members"
  ON print_jobs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- Shop members can create print jobs for their shop
CREATE POLICY "Print jobs insertable by shop members"
  ON print_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- Shop admin/manager can update print job status
CREATE POLICY "Print jobs updatable by shop admin/manager"
  ON print_jobs FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Shop admin/manager can delete print jobs
CREATE POLICY "Print jobs deletable by shop admin/manager"
  ON print_jobs FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- VERIFICATION:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'print_jobs' ORDER BY ordinal_position;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'print_jobs';
-- ================================================================
```

---

## Phase 4: Code Changes Required

### 4.1 Prioritized Code Changes

#### P0 — BLOCKERS (Must fix before DB migration)

| # | File | Lines | Change | Why |
|---|------|-------|--------|-----|
| 1 | `src/context/SupabaseAppContext.tsx` | 97 | Remove `currency: 'LKR'` from `initialState.settings`. Replace all `state.settings.currency` references with a hardcoded `'MMK'` constant. Remove `currency` field from `AppSettings` type. | **Breaking bug:** Shows Sri Lankan Rupee (LKR) everywhere. VISION.md §19 mandates MMK-only. |
| 2 | `src/types/index.ts` | 185-198 | Confirm `AppSettings` has no `currency` field. If a `currency` field exists in the type, remove it. | Type already correct; runtime state is wrong (see #1) |
| 3 | 20+ component files | Various | Replace `state.settings.currency` with `'MMK'` constant: `Cart.tsx`, `CheckoutModal.tsx`, `TransactionsManager.tsx`, `ReceiptPrint.tsx`, `ProductGrid.tsx`, `DiscountManager.tsx`, `InventoryManager.tsx`, `ReportsManager.tsx` | Display wrong currency across all price/amount sites |

#### P1 — HIGH (Fix immediately after P0)

| # | File | Lines | Change | Why |
|---|------|-------|--------|-----|
| 4 | `docs/specs/tier-spec.md` | 44 | Resolve `profit_analytics` discrepancy — remove from tier-spec.md OR add to VISION.md §5.5 | 18-vs-19 key mismatch; blocks future CI validation |
| 5 | `src/lib/services.ts` | 743-766 | `settingsService.get()` — already doesn't map `currency`. Ensure it stays that way after `currency` is removed from `AppSettings`. | Remove any accidental currency mapping |
| 6 | `src/components/inventory/ProductModal.tsx` | 258 | Remove `supplierInfo: ''` from batch creation default | Dead field in dead feature |
| 7 | `src/components/pos/CheckoutModal.tsx` | 359 | Update stale comment: `"// Atomic checkout via RPC (handles sale, invoice, stock deduction, customer update)"` — remove "kitchen orders" reference | Dead feature reference in comment |

#### P2 — MEDIUM (Fix in next sprint)

| # | File | Lines | Change | Why |
|---|------|-------|--------|-----|
| 8 | `src/lib/services.ts` | 9, 200, 239, 289, 344 | Remove `supplier_info`/`supplierInfo` mapping from product batch CRUD | Dead field mapping |
| 9 | `src/lib/services.ts` | 1753 | Remove `currency` from `PlatformDailyStats` interface | Dead field in interface |
| 10 | `src/components/platform/PlatformDashboard.tsx` | 7 | Remove `currency` from `PlatformDailyStats` default | Dead data in platform admin |
| 11 | `src/lib/database.types.ts` | 302-350, 554-814, 1245-1643 | Regenerate after DB migration drops dead tables/columns | Stale generated types reference dead DB objects |

#### P3 — LOW (Nice to have)

| # | File | Lines | Change | Why |
|---|------|-------|--------|-----|
| 12 | 9 unused capability keys | Various | Audit whether `draft_sales`, `batch_tracking`, `weight_based_products`, `purchase_log`, `stock_overview`, `low_stock_alerts`, `cash_drawer`, `owner_insights`, `simple_profit_report` should have `useCapability()` gates | Currently features render unconditionally. May be intentional. |
| 13 | `src/components/settings/Settings.tsx` | 149-160 | Remove disabled Currency display field | Redundant if MMK is a constant |
| 14 | Future DB migrations | — | DROP dead tables: `currency_config`, `exchange_rates`, `exchange_rate_history`, `kitchen_orders`, `recipes`, `suppliers` | Dead tables still in DB |
| 15 | Future DB migrations | — | DROP dead columns: `app_settings.exchange_rate_api_key`, `app_settings.exchange_rate_provider`, `app_settings.exchange_rate_update_interval`, `product_batches.supplier_info`, `sales.exchange_rate_used` | Dead columns still in live tables |

---

## 🚨 Critical Blockers

### 1. Currency Bug — WRONG CURRENCY DISPLAY (P0)

`state.settings.currency` returns `'LKR'` (Sri Lankan Rupee) instead of `'MMK'`. This affects every price display in the application. **Must be fixed before any user-facing release.**

### 2. Missing Capability Keys in DB (P0)

7 valid capability keys are missing from `feature_definitions`. Capability resolution will never grant them server-side, even if `useCapability()` is added to components.

### 3. `profit_analytics` Documentation Discrepancy (P1)

19 keys in tier-spec.md vs 18 in VISION.md §5.5. Blocks CI validation of tier alignment (VISION.md §5.4 protocol).

### 4. `print_jobs` Table Missing (P1)

Referenced by `services.ts` but does not exist. `printJobsService` operations will fail at runtime.

---

## 📋 Recommended Execution Order

### Before Any DB Migration

1. **Fix currency bug (P0):**
   - Create `src/lib/constants.ts` with `export const CURRENCY = 'MMK' as const`
   - Remove `currency` from `initialState.settings` in `SupabaseAppContext.tsx`
   - Replace all `state.settings.currency` with `CURRENCY` in all component files
   - Run `npx vitest` to verify no regressions

2. **Resolve `profit_analytics` discrepancy (P1):**
   - Remove `profit_analytics` from `tier-spec.md` and `feature-gating.md`

### Execute DB Migrations (in order)

3. **Run Migration 1:** `20260714050000_remove_dead_capability_keys.sql`
   - Removes 4 dead keys from `feature_definitions`
   - Invokes `@db-guardian` first (per CLAUDE.md DB Safety Hook)

4. **Run Migration 2:** `20260714050001_seed_missing_capability_keys.sql`
   - Inserts 7 missing capability keys
   - Invokes `@db-guardian` first

5. **Run Migration 3:** `20260714050002_create_print_jobs_table.sql`
   - Creates `print_jobs` table with RLS policies
   - Invokes `@db-guardian` first

### After DB Migration

6. **Regenerate types:** `npx supabase gen types typescript`
   - Updates `database.types.ts` to reflect new schema

7. **Fix P1 code changes:** Clean up stale comments and dead field mappings

8. **Plan capability gate audit (P3):** Decide which of the 9 unused capability keys need actual component gates

---

## Summary

The codebase is in good shape for capability-based feature gating — the `useCapability()` hook exists and is used correctly with zero violations. The primary issues are:

1. **4 dead capability keys seeded in DB** — remove via migration
2. **7 valid capability keys missing from DB** — add via migration  
3. **`print_jobs` table missing** — needed for Growth+ printer integration
4. **Currency bug** — `state.settings.currency` returns `'LKR'` instead of `'MMK'` in 20+ places
5. **Documentation mismatch** — `profit_analytics` in tier-spec.md but not VISION.md

Three database migrations and ~20 lines of code changes (plus constant replacement) will fully align the codebase with VISION.md v3.1.0.

---

*Report generated by 4-phase parallel codebase scan (2026-07-14)*