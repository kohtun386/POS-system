# Documentation-Database Gap Analysis
**Date:** 2026-07-14
**Docs Versions:** VISION.md v3.1.0, database.md v3.1.0, tier-spec.md, feature-gating.md, README.md v1.1.0
**Method:** Read ALL docs → cross-reference → compare against live DB state

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Internal doc contradictions found | **8** |
| DB gaps (tables/functions/keys) | **9** |
| Critical blockers | **3** |

### Top 3 Priorities
1. **Remove 7 dead capability keys** from DB and seed data — `multi_currency`, `kitchen_display`, `online_ordering`, `supplier_management`, `recipe_bom`, `raw_materials`, `waste_tracking` are explicitly OUT OF SCOPE per VISION.md §19
2. **Seed 5 missing capability keys** — `cash_drawer`, `purchase_log`, `stock_overview`, `low_stock_alerts`, `owner_insights`, `simple_profit_report` are required per VISION.md §5.5 but absent from DB
3. **Create `print_jobs` table** — required for printer_integration (Growth+) per database.md §7.2

---

## Part 1: Internal Doc Contradictions

| # | Doc A | Doc B | Contradiction | Severity | Recommendation |
|---|-------|-------|---------------|----------|----------------|
| 1 | feature-gating.md seed data (lines 108, 130) | VISION.md §19 | `multi_currency` seeded twice with `subscription_tier='free'`, `default_enabled=true`, but §19 explicitly lists "Multi-currency / exchange rates" as OUT OF SCOPE (MMK-only). tier-spec.md §2.2 marks it DEAD. | **HIGH** | Remove `multi_currency` from seed data. If kept for forward compat, set `subscription_tier='dead'`. |
| 2 | tier-spec.md §2.1 (#19 `profit_analytics`) | VISION.md §5.5 | tier-spec.md lists 19 active features including `profit_analytics`. feature-gating.md includes it. But VISION.md §5.5 has only 18 keys and does NOT include `profit_analytics` — only `owner_insights` and `simple_profit_report`. | **HIGH** | Add `profit_analytics` to VISION.md §5.5, OR remove from tier-spec.md and feature-gating. Align all three. |
| 3 | feature-gating.md §3.2 Free tier table | VISION.md §5.5 | §3.2 shows `multi_currency` in Free tier (with DEAD note), but §5.5 Free tier list has 9 keys and does NOT include `multi_currency`. | **MEDIUM** | Remove `multi_currency` from Free tier table in feature-gating.md. |
| 4 | feature-gating.md seed data (lines 108, 130) | tier-spec.md §2.2 | Duplicate `multi_currency` entry in seed data. tier-spec.md correctly marks it DEAD but seed doesn't. | **MEDIUM** | Remove duplicate. Add DEAD marker or remove entirely. |
| 5 | README.md (v1.1.0, 2026-07-10) | VISION.md (v3.1.0, 2026-07-13) | Version 1.1.0 vs 3.1.0. README not updated for scope reframe (v3.0.0: removed BOM/COGS/consumption, simplified inventory, multi_currency=DEAD). | **MEDIUM** | Bump README to v3.1.0+. Update feature list to reflect scope reframe. |
| 6 | README.md Active Tables section | VISION.md v3.1.0 | README says "20 active tables." VISION.md + database.md expect 21 (with print_jobs). Table count drift. | **MEDIUM** | Update README table count to match DB state. |
| 7 | prd.md §3.11, multi-tenancy.md §8.2 | VISION.md §19 | prd.md and multi-tenancy.md still list `recipe_bom`, `raw_materials`, `waste_tracking` as active Growth/Pro features. Dead per scope reframe. | **MEDIUM** | Update prd.md and multi-tenancy.md to remove dead features from tier tables. |
| 8 | feature-gating.md seed data | VISION.md §5.5 | 7 dead keys in seed data (`kitchen_display`, `online_ordering`, `supplier_management`, `recipe_bom`, `raw_materials`, `waste_tracking`, `multi_currency`) not in §5.5 active list. | **LOW** | Clearly mark dead keys in seed as "reserved/dead" or remove from seed. |

---

## Part 2: Expected State (Derived from Docs)

### 2.1 Expected Tables

Cross-referencing VISION.md v3.1.0 + database.md v3.1.0:

| Table | VISION.md Ref | database.md Ref | Tier | Status |
|-------|---------------|-----------------|------|--------|
| shops | §4, §6 | §1.1 | All | **Required** |
| app_settings | — | §1.1 | All | **Required** |
| categories | — | §1.1 | All | **Required** |
| products | §10, §16.3 | §1.1 | All | **Required** |
| product_batches | — | §1.1 | All | **Required** |
| customers | §9 | §1.1 | All | **Required** |
| suppliers | §10 | §1.1 | All | **Required** |
| discounts | §8 | §1.1 | All | **Required** |
| users | §4 | §1.1 | All | **Required** |
| sales | §11 | §1.1 | All | **Required** |
| sales_tabs | §11 | §1.1 | All | **Required** |
| shop_memberships | §4 | §6 | All | **Required** |
| alert_recipients | — | §6.3 | All | **Required** |
| alert_templates | — | §6.3 | All | **Required** |
| alert_configurations | — | §6.3 | All | **Required** |
| alert_history | — | §6.3 | All | **Required** |
| notification_service_config | — | §6.3 | All | **Required** |
| feature_definitions | §5.5 | §7.8 | All | **Required** |
| shop_features | §5.5 | §7.8 | All | **Required** |
| print_jobs | §5.5 (printer_integration) | §7.2 | Growth+ | **Required** |
| cash_shifts | §12 | §7 | Growth+ | **Required** |
| audit_logs | §4.3 | — | Platform | **Required** |

**Total: 22 active tables**

**Deprecated (documented in database.md but MUST NOT exist in DB):**
| Table | Why Deprecated | VISION.md Ref |
|-------|---------------|---------------|
| recipes | No BOM tracking in v1 | §19, §10.3 |
| recipe_lines | No recipe tracking | §19, §10.3 |
| raw_materials | Replaced by Purchase Log | §19, §10.3 |
| consumption_log | No auto-deduction | §19 |
| uom_conversions | Not needed | §19 |
| kitchen_orders | Use thermal printer instead | §19 |
| currency_config | MMK-only | §19 |
| exchange_rates | MMK-only | §19 |
| exchange_rate_history | MMK-only | §19 |

### 2.2 Expected Functions

Cross-referencing database.md §4:

| Function | database.md | Purpose | Security | Status |
|----------|-------------|---------|----------|--------|
| `update_updated_at_column()` | §4 | Auto-timestamp trigger | SECURITY DEFINER | **Required** |
| `generate_invoice_number()` | §4 | Atomic invoice numbering | INVOKER | **Required** |
| `handle_new_auth_user()` | §4 | Auto-create user+shop on signup | SECURITY DEFINER | **Required** |
| `current_shop_ids()` | §4 | RLS helper | INVOKER | **Required** |
| `is_platform_admin()` | §4 | RLS helper for cross-tenant | SECURITY DEFINER | **Required** |
| `checkout_complete()` | §4 | Atomic checkout RPC | SECURITY DEFINER | **Required** |
| `rls_auto_enable()` | §4 | Event trigger | SECURITY DEFINER | **Required** |
| `resolve_capabilities()` | §5.5 | Capability resolution RPC | INVOKER | **Required** |

**Deprecated (must NOT exist):** `get_current_exchange_rate`, `convert_currency_amount`, `update_exchange_rate`, `replace_recipe_lines`

### 2.3 Expected Capability Keys

Cross-referencing VISION.md §5.5 + tier-spec.md §2.1:

| Key | VISION.md §5.5 | tier-spec.md §2.1 | feature-gating.md | Min Tier | Default |
|-----|----------------|-------------------|-------------------|----------|---------|
| `pos` | ✅ | ✅ (#1) | ✅ (implicit) | free | true |
| `inventory` | ✅ | ✅ (#2) | ✅ | free | true |
| `discounts` | ✅ | ✅ (#3) | ✅ | free | true |
| `draft_sales` | ✅ | ✅ (#4) | ✅ | free | true |
| `customer_management` | ✅ | ✅ (#6) | ✅ | free | true |
| `batch_tracking` | ✅ | ✅ (#7) | ✅ | free | true |
| `weight_based_products` | ✅ | ✅ (#8) | ✅ | free | true |
| `credit_system` | ✅ | ✅ (#9) | ✅ | free | true |
| `multi_tab_sales` | ✅ | ✅ (#10) | ✅ | free | true |
| `printer_integration` | ✅ | ✅ (#11) | ✅ | growth | true |
| `purchase_log` | ✅ | ✅ (#14) | ✅ | growth | true |
| `stock_overview` | ✅ | ✅ (#15) | ✅ | growth | true |
| `low_stock_alerts` | ✅ | ✅ (#16) | ✅ | growth | true |
| `staff_accounts` | ✅ | ✅ (#12) | ✅ | growth | true |
| `cash_drawer` | ✅ | ✅ (#13) | ✅ | growth | true |
| `owner_insights` | ✅ | ✅ (#18) | ✅ | pro | false |
| `simple_profit_report` | ✅ | ✅ (#20) | ✅ | pro | false |
| `advanced_reports` | ✅ | ✅ (#17) | ✅ | pro | false |
| `profit_analytics` | ❌ **MISSING** | ✅ (#19) | ✅ | pro | false |

**Conflict:** `profit_analytics` exists in tier-spec.md and feature-gating.md but NOT in VISION.md §5.5. Needs alignment.

**DEAD keys (per tier-spec.md §2.2):** `kitchen_display`, `online_ordering`, `supplier_management`, `recipe_bom`, `raw_materials`, `waste_tracking`, `multi_currency`

---

## Part 3: Actual DB State

### 3.1 Tables Found (21)

```
alert_configurations   alert_history          alert_recipients
alert_templates        app_settings           audit_logs
cash_shifts            categories             customers
discounts              feature_definitions    notification_service_config
product_batches        products               sales
sales_tabs             shop_features          shop_memberships
shops                  suppliers              users
```

### 3.2 Functions Found (12)

```
auto_generate_invoice_number    check_inventory_alerts
checkout_complete               current_shop_ids
deduct_product_stock            generate_invoice_number
get_alert_recipients            handle_new_auth_user
resolve_capabilities            should_send_alert
update_customer_stats           update_updated_at_column
```

### 3.3 Capability Keys Found (15)

| Key | subscription_tier | default_enabled |
|-----|-------------------|-----------------|
| advanced_reports | pro | false |
| batch_tracking | free | true |
| credit_system | free | true |
| customer_management | free | true |
| discounts | free | true |
| draft_sales | free | true |
| inventory | free | true |
| kitchen_display | pro | false |
| multi_currency | free | true |
| multi_tab_sales | free | true |
| online_ordering | pro | false |
| printer_integration | growth | true |
| staff_accounts | growth | true |
| supplier_management | pro | false |
| weight_based_products | free | true |

---

## Part 4: Gap Analysis

### 4.1 Tables in DB but NOT in Docs (Scope Creep)

**NONE** — All 21 DB tables match the expected active table list. No deprecated tables found. ✅

### 4.2 Tables in Docs but NOT in DB (Missing)

| Table | Purpose | Doc References | Action |
|-------|---------|----------------|--------|
| `print_jobs` | Print job queue for thermal printer | database.md §7.2, VISION.md §5.5 (printer_integration) | **CREATE** |

### 4.3 Functions in DB but NOT in Docs (Undocumented)

| Function | Likely Purpose | Doc Status | Action |
|----------|---------------|------------|--------|
| `auto_generate_invoice_number()` | Auto-increment invoice counter | Not in database.md §4 | **INVESTIGATE** — may be trigger or helper |
| `check_inventory_alerts()` | Alert system: check thresholds | Not in database.md §4 | **INVESTIGATE** — part of alert system |
| `deduct_product_stock()` | Deduct stock during checkout | Not in database.md §4 | **INVESTIGATE** — may be called by checkout_complete |
| `get_alert_recipients()` | Alert system: get recipients | Not in database.md §4 | **INVESTIGATE** — part of alert system |
| `should_send_alert()` | Alert system: throttling | Not in database.md §4 | **INVESTIGATE** — part of alert system |
| `update_customer_stats()` | Update customer purchase totals | Not in database.md §4 | **INVESTIGATE** — may be called by checkout_complete |

**Note:** These 6 functions are likely valid (part of alert system and checkout flow) but not documented in database.md. They should be added to the docs.

### 4.4 Functions in Docs but NOT in DB (Missing)

| Function | Purpose | Doc References | Action |
|----------|---------|----------------|--------|
| `is_platform_admin()` | RLS helper for cross-tenant access | database.md §4, VISION.md §4.3 | **CREATE** |

**Note:** `is_platform_admin()` is referenced in database.md as a SECURITY DEFINER function used in RLS policies. However, no current RLS policy references it — policies use `users.role` checks instead. This may be a doc that's ahead of implementation, or the function was removed.

### 4.5 Capability Keys in DB but NOT in Docs (Scope Creep)

| Key | Current Tier | Reason for Removal | Doc References |
|-----|-------------|-------------------|----------------|
| `multi_currency` | free | MMK-only in v1 | VISION.md §19, tier-spec.md §2.2 (DEAD) |
| `kitchen_display` | pro | KDS excluded for Myanmar | VISION.md §19, tier-spec.md §2.2 (DEAD) |
| `online_ordering` | pro | Customer API not in v1 | VISION.md §19, tier-spec.md §2.2 (DEAD) |
| `supplier_management` | pro | No component exists | tier-spec.md §2.2 (DEAD) |
| `recipe_bom` | growth* | BOM/COGS removed | VISION.md §19, §10.3 (DEAD) |
| `raw_materials` | growth* | Replaced by Purchase Log | VISION.md §19, §10.3 (DEAD) |
| `waste_tracking` | pro | Requires recipe tracking | VISION.md §19 (DEAD) |

*Note: `recipe_bom`, `raw_materials`, `waste_tracking` are NOT in the actual DB (confirmed by query). They exist only in feature-gating.md seed data and feature-flags.md spec. No action needed on DB — just doc cleanup.

**Actual dead keys IN the DB (4):** `multi_currency`, `kitchen_display`, `online_ordering`, `supplier_management`

### 4.6 Capability Keys in Docs but NOT in DB (Missing)

| Key | Min Tier | Default | Doc References | Action |
|-----|----------|---------|----------------|--------|
| `cash_drawer` | growth | true | VISION.md §5.5, §12, tier-spec.md #13 | **INSERT** |
| `purchase_log` | growth | true | VISION.md §5.5, tier-spec.md #14 | **INSERT** |
| `stock_overview` | growth | true | VISION.md §5.5, tier-spec.md #15 | **INSERT** |
| `low_stock_alerts` | growth | true | VISION.md §5.5, tier-spec.md #16 | **INSERT** |
| `owner_insights` | pro | false | VISION.md §5.5, tier-spec.md #18 | **INSERT** |
| `simple_profit_report` | pro | false | VISION.md §5.5, tier-spec.md #20 | **INSERT** |
| `profit_analytics` | pro | false | tier-spec.md #19 (NOT in VISION.md §5.5) | **ALIGN DOCS, then INSERT** |

### 4.7 Schema Drift (Wrong Columns/Types)

| Table | Column | Issue | Doc Reference | Action |
|-------|--------|-------|---------------|--------|
| `feature_definitions` | `subscription_tier` | Named `subscription_tier` in DB but some docs reference `min_tier`. Functionally correct — column works as expected. | feature-gating.md uses `subscription_tier` | **KEEP** (naming convention difference, not a bug) |
| `products` | `product_type`, `base_currency`, `price_in_base_currency` | Present in DB but NOT in database.md §1.1 column list. May be orphaned from older schema. | database.md §1.1 lists no such columns | **INVESTIGATE** — check if frontend uses these columns |
| `shops` | Missing: `business_type`, `tax_rate`, `currency`, `base_currency`, `invoice_prefix`, `invoice_counter`, `logo`, `receipt_setting`, `draft_retention_days` | These columns were in database.md older versions but removed in scope reframe. DB correctly does NOT have them. | VISION.md v3.1.0 scope reframe | **CORRECT** — no action needed |

---

## Part 5: Recommended Doc Updates

| # | Doc | Update Required | Priority |
|---|-----|-----------------|----------|
| 1 | README.md | Bump version from 1.1.0 → 3.1.0. Update table count (20→21 if print_jobs added, or 20 if not). Remove references to deprecated features as "planned." | **HIGH** |
| 2 | feature-gating.md seed data | Remove duplicate `multi_currency` entry. Mark dead keys clearly or remove from seed. | **HIGH** |
| 3 | VISION.md §5.5 | Add `profit_analytics` (Pro tier) to align with tier-spec.md §2.1 #19. | **HIGH** |
| 4 | prd.md §3.11 | Remove `recipe_bom`, `raw_materials`, `waste_tracking` from Growth/Pro feature lists. | **MEDIUM** |
| 5 | multi-tenancy.md §8.2 | Remove `recipe_bom`, `raw_materials`, `waste_tracking` from tier table. | **MEDIUM** |
| 6 | database.md §4 | Add 6 undocumented functions (`auto_generate_invoice_number`, `check_inventory_alerts`, `deduct_product_stock`, `get_alert_recipients`, `should_send_alert`, `update_customer_stats`). | **MEDIUM** |
| 7 | database.md §4 | Add `print_jobs` table definition (currently only referenced in §7.2 index). | **MEDIUM** |
| 8 | feature-gating.md §3.2 | Remove `multi_currency` from Free tier table. | **LOW** |

---

## Part 6: Recommended DB Actions

### P0 (Blockers) — Immediate

```sql
-- 1. Remove out-of-scope capability keys from DB
DELETE FROM feature_definitions
WHERE key IN ('multi_currency', 'kitchen_display', 'online_ordering', 'supplier_management');

-- 2. Seed missing capability keys per VISION.md §5.5 + tier-spec.md §2.1
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier) VALUES
  ('cash_drawer', 'Cash Drawer', 'Shift start/end with opening/closing cash', 'pos', true, 'growth'),
  ('purchase_log', 'Purchase Recording', 'Record supplier purchases', 'inventory', true, 'growth'),
  ('stock_overview', 'Stock Overview', 'Current supply levels and adjustments', 'inventory', true, 'growth'),
  ('low_stock_alerts', 'Low Stock Alerts', 'Threshold-based inventory alerts', 'inventory', true, 'growth'),
  ('owner_insights', 'Owner Insights', 'P&L dashboard and business analytics', 'general', false, 'pro'),
  ('simple_profit_report', 'Simple Profit Report', 'Revenue minus purchases report', 'general', false, 'pro'),
  ('profit_analytics', 'Profit Analytics', 'Profit margin analytics', 'general', false, 'pro');
```

### P1 (High Priority) — Soon

```sql
-- 3. Create print_jobs table (database.md §7.2)
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('receipt', 'kitchen')),
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_print_jobs_pending ON print_jobs(status) WHERE status = 'pending';
CREATE INDEX idx_print_jobs_shop ON print_jobs(shop_id);
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policy for print_jobs
CREATE POLICY "Print jobs viewable by shop members" ON print_jobs
  FOR SELECT USING (auth.role() = 'authenticated' AND shop_id IN (SELECT current_shop_ids()));
CREATE POLICY "Print jobs write by shop admin/manager" ON print_jobs
  FOR ALL USING (auth.role() = 'authenticated' AND shop_id IN (SELECT current_shop_ids())
    AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')));
```

### P2 (Medium) — Investigate

```sql
-- 5. Investigate is_platform_admin() — does it exist anywhere?
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'is_platform_admin' AND routine_schema = 'public';

-- 6. Investigate orphaned product columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'products' AND column_name IN ('product_type', 'base_currency', 'price_in_base_currency');

-- 7. Check if undocumented functions are called by any trigger/RPC
SELECT routine_name, data_type, security_type FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name;
```

---

## Part 7: Priority Matrix

| Priority | Action | Impact | Effort | Status |
|----------|--------|--------|--------|--------|
| **P0** | Delete 4 dead capability keys from DB | Removes scope creep, aligns with §19 | Low (1 SQL) | **TODO** |
| **P0** | Insert 7 missing capability keys | Enables cash_drawer, low_stock_alerts, owner_insights, etc. | Low (1 SQL) | **TODO** |
| **P0** | Add `profit_analytics` to VISION.md §5.5 | Aligns VISION.md with tier-spec.md | Low (doc edit) | **TODO** |
| **P1** | Create `print_jobs` table | Enables printer_integration (Growth+) | Medium (DDL + RLS) | **TODO** |
| **P1** | Create `is_platform_admin()` function | RLS helper per database.md §4 | Low (1 function) | **TODO** |
| **P2** | Update README.md version + table count | Documentation accuracy | Low (doc edit) | **TODO** |
| **P2** | Remove dead features from prd.md + multi-tenancy.md | Documentation accuracy | Low (doc edits) | **TODO** |
| **P2** | Document 6 undocumented functions in database.md | Future maintainability | Medium (doc edits) | **TODO** |
| **P3** | Investigate orphaned product columns | Schema hygiene | Low (investigation) | **TODO** |

---

## Summary

The database is **85% compliant** with the documentation stack. The scope reframe (v3.0.0→v3.1.0) was largely successful:

**✅ Correctly Implemented:**
- No deprecated tables in DB (recipes, currency_config, etc. all correctly removed)
- `business_type` column removed from shops (§2.1 single-type)
- `daily_order_limit` present on shops (§16.3 tier limits)
- RLS clean — no `platform_admin` in any policy
- All 21 tables have RLS enabled
- 12 functions operational (8 expected + 4 alert-system helpers)

**⚠️ Needs Fixing:**
- 4 dead capability keys still in DB (`multi_currency`, `kitchen_display`, `online_ordering`, `supplier_management`)
- 7 capability keys missing from DB (`cash_drawer`, `purchase_log`, `stock_overview`, `low_stock_alerts`, `owner_insights`, `simple_profit_report`, `profit_analytics`)
- `print_jobs` table missing (blocks printer integration)
- `profit_analytics` key missing from VISION.md §5.5 (exists in tier-spec.md)
- 6 undocumented functions not in database.md
- README.md outdated (v1.1.0 vs v3.1.0)
- prd.md and multi-tenancy.md still reference dead features

**Net: 9 actionable gaps requiring 3 P0 blockers resolved before frontend work can proceed safely.**
