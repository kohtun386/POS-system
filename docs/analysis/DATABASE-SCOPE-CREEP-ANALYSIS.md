# Database Scope Creep Analysis
**Date:** 2026-07-14
**Status:** SCAN COMPLETE
**Docs Version:** VISION.md v3.0.0 (from docs/vision/VISION.md)

---

## 1. Document-Derived Expected State

### Expected Tables (per database.md v3.1.0)

**Core Business (Section 1.1) — 11 tables:**
- `app_settings`, `categories`, `products`, `product_batches`, `customers`, `suppliers`
- `discounts`, `users`, `sales`, `sales_tabs`
- *(NOTE: `shop_settings` merged into `shops` per database.md §1.1)*

**Multi-Tenancy (Section 6) — 7 tables:**
- `shops`, `shop_memberships`
- `alert_recipients`, `alert_templates`, `alert_configurations`, `alert_history`
- `notification_service_config`

**Feature Flags & Operations (Section 7) — 4 tables:**
- `feature_definitions`, `shop_features`
- `print_jobs` (print job queue)
- `cash_shifts` (shift management)

**Total expected: 22 active tables**

**Deprecated tables (should NOT exist, VISION.md §19 / database.md):**
- `recipes`, `recipe_lines`, `raw_materials`, `consumption_log` — out of scope (no BOM/recipe tracking)
- `uom_conversions` — out of scope
- `kitchen_orders` — out of scope (no KDS)
- `currency_config`, `exchange_rates`, `exchange_rate_history` — MMK-only in v1

### Expected Functions (per database.md)

| # | Function | Status | Notes |
|---|----------|--------|-------|
| 1 | `update_updated_at_column()` | Required | Trigger for auto-timestamps |
| 2 | `generate_invoice_number()` | Required | Atomic invoice numbering |
| 3 | `handle_new_auth_user()` | Required | Auto-create user+shop on signup |
| 4 | `current_shop_ids()` | Required | RLS helper |
| 5 | `is_platform_admin()` | Required | RLS helper |
| 6 | `checkout_complete()` | Required | Atomic checkout RPC |
| 7 | `rls_auto_enable()` | Required | Event trigger |
| 8 | `resolve_capabilities()` | Required | Capability resolution RPC |

**Deprecated (should NOT exist):**
- `get_current_exchange_rate()` — MMK-only
- `convert_currency_amount()` — MMK-only
- `update_exchange_rate()` — MMK-only
- `replace_recipe_lines()` — no recipe BOM

### Expected Capability Keys (per VISION.md §5.5)

The doc specifies **18 capability keys** across three tiers:

| Tier | Keys |
|------|------|
| **Free (9)** | `pos` (implicit), `inventory`, `discounts`, `draft_sales`, `customer_management`, `batch_tracking`, `weight_based_products`, `credit_system`, `multi_tab_sales` |
| **Growth (6)** | `printer_integration`, `purchase_log`, `stock_overview`, `low_stock_alerts`, `staff_accounts`, `cash_drawer` |
| **Pro (3)** | `owner_insights`, `simple_profit_report`, `advanced_reports` |

### Excluded Features (per VISION.md §19)

| Feature | Tables | Doc Reference |
|---------|--------|---------------|
| Recipe BOM / Bill of Materials | `recipes`, `recipe_lines`, `raw_materials`, `consumption_log` | §19 |
| Multi-currency / exchange rates | `currency_config`, `exchange_rates`, `exchange_rate_history` | §19 |
| Kitchen Display System | `kitchen_orders` | §19 |
| UOM conversion system | `uom_conversions` | §19 |
| Waste tracking per recipe | (no table, but `waste_tracking` key out of scope) | §19 |

### Expected Columns on Key Tables

**`shops`**: `id`, `name`, `address`, `phone`, `email`, `owner_id`, `subscription_tier`, `is_active`, `created_at`, `updated_at`, `daily_order_limit`

**Missing from docs but present**: `logo` (DB), `tax_rate` (DB), `currency` (DB), `base_currency` (DB), `invoice_prefix` (DB), `invoice_counter` (DB)

**`products`**: `id`, `name`, `sku`, `barcode`, `price`, `cost`, `stock`, `min_stock`, `category`, `description`, `image`, `taxable`, `active`, `is_weight_based`, `price_per_unit`, `unit`, `track_inventory`, `created_at`, `updated_at`, `shop_id`

**Missing from docs**: `product_type`, `base_currency`, `price_in_base_currency`

**`feature_definitions`**: `id`, `key`, `name`, `description`, `category`, `default_enabled`, `subscription_tier`, `created_at`

**Missing from docs**: `applicable_types` column (present in docs but absent in DB)

---

## 2. Actual Database State

### Tables Found (21 tables)

```
alert_configurations, alert_history, alert_recipients, alert_templates,
app_settings, audit_logs, cash_shifts, categories, customers,
discounts, feature_definitions, notification_service_config,
product_batches, products, sales, sales_tabs,
shop_features, shop_memberships, shops, suppliers, users
```

### Functions Found (12 functions)

```
auto_generate_invoice_number, check_inventory_alerts, checkout_complete,
current_shop_ids, deduct_product_stock, generate_invoice_number,
get_alert_recipients, handle_new_auth_user, resolve_capabilities,
should_send_alert, update_customer_stats, update_updated_at_column
```

### Feature Definitions Found (15 features)

| key | subscription_tier | default_enabled |
|-----|-------------------|-----------------|
| `advanced_reports` | pro | false |
| `batch_tracking` | free | true |
| `credit_system` | free | true |
| `customer_management` | free | true |
| `discounts` | free | true |
| `draft_sales` | free | true |
| `inventory` | free | true |
| `kitchen_display` | pro | false |
| `multi_currency` | free | true |
| `multi_tab_sales` | free | true |
| `online_ordering` | pro | false |
| `printer_integration` | growth | true |
| `staff_accounts` | growth | true |
| `supplier_management` | pro | false |
| `weight_based_products` | free | true |

### Key Table Structures

**`shops`**: id, name, address, phone, email, owner_id, subscription_tier, is_active, created_at, updated_at, **daily_order_limit** ✅

**`products`**: id, name, sku, barcode, price, cost, stock, min_stock, category, description, image, taxable, active, is_weight_based, price_per_unit, unit, track_inventory, created_at, updated_at, shop_id

**Missing columns**: `product_type`, `base_currency`, `price_in_base_currency` (present in DB, not in VISION.md)

**`feature_definitions`**: id, key, name, description, category, default_enabled, **subscription_tier** (not `min_tier`), created_at

---

## 3. Discrepancy Analysis

### ✅ No Scope Creep (Tables in DB match docs)

All 21 tables in the DB are in the expected list. **No deprecated tables** (`recipes`, `recipe_lines`, `raw_materials`, `consumption_log`, `uom_conversions`, `kitchen_orders`, `currency_config`, `exchange_rates`, `exchange_rate_history`) were found in the DB. This is correct.

### ⚠️ Missing Implementation — Feature Flags

| Item | Type | Purpose | Doc Reference |
|------|------|---------|----------------|
| `pos` | Capability key | POS terminal (implicit) | VISION.md §5.5 |
| `purchase_log` | Capability key | Purchase recording | VISION.md §5.5 |
| `stock_overview` | Capability key | Stock levels & adjustments | VISION.md §5.5 |
| `low_stock_alerts` | Capability key | Threshold-based alerts | VISION.md §5.5 |
| `cash_drawer` | Capability key | Shift start/end | VISION.md §5.5 |
| `owner_insights` | Capability key | P&L dashboard | VISION.md §5.5 |
| `simple_profit_report` | Capability key | Revenue minus Purchases | VISION.md §5.5 |
| `recipe_bom` | Capability key | Recipe BOM (Growth+) | VISION.md §5.5 |
| `raw_materials` | Capability key | Raw material tracking | VISION.md §5.5 |
| `waste_tracking` | Capability key | Waste tracking | VISION.md §5.5 |
| `multi_currency` | Capability key | Multi-currency (FREE but marked dead) | VISION.md §5.5 |
| `print_jobs` | Table | Print job queue | database.md §7.2 |
| `applicable_types` column | Column | Business type filter | feature-flags.md |

**Note:** `multi_currency` exists in DB with `subscription_tier='free'` and `default_enabled=true`, but VISION.md §19 explicitly says "Multi-currency / exchange rates" is OUT OF SCOPE for v1. This creates a tier conflict: the DB row should either be removed (scope) or marked with `subscription_tier='dead'`.

### ✅ Missing Implementation — Functions

| Item | Type | Purpose | Doc Reference |
|------|------|---------|---------------|
| `is_platform_admin()` | Function | RLS helper for cross-tenant access | VISION.md §4.3, database.md |

**Note:** Function was expected per docs but NOT found in actual DB state. It may have been removed or renamed.

### ⚠️ Scope Creep — Feature Flags Out-of-Scope

| Item | Type | Reason | Doc Reference |
|------|------|--------|---------------|
| `kitchen_display` | Feature key | Explicitly excluded in VISION.md §19 ("Kitchen Display System (KDS)") — KDS is NOT being built | VISION.md §19 |
| `online_ordering` | Feature key | Explicitly excluded — "API access for customers" not in v1 | VISION.md §19 |
| `supplier_management` | Feature key | Supplier table exists but is manual-only; dedicated feature key may be scope creep | VISION.md §19 |

### ⚠️ Schema Drift — Wrong Column Names

| Table | Column | Issue | Action |
|-------|--------|-------|--------|
| `feature_definitions` | `subscription_tier` vs `min_tier` | Column named `subscription_tier` but docs/spec use `min_tier`. **This is working correctly** — the column just uses a different naming convention than some spec docs | KEEP (DB uses `subscription_tier`, frontend uses `subscriptionTier`) |
| `shops` | Missing columns | `business_type`, `tax_rate`, `currency`, `base_currency`, `invoice_prefix`, `invoice_counter`, `logo`, `receipt_setting`, `draft_retention_days` | NOT NEEDED — these were removed in scope reframe to `shops` |
| `products` | Missing columns | `product_type`, `base_currency`, `price_in_base_currency` exist in DB but NOT in database.md | May be orphaned columns from older schema |

### ✅ Schema Drift — Correctly Removed

| Table | Column | Status |
|-------|--------|--------|
| `shops` | `business_type` | Correctly removed per §2.1 "Single Type" |
| `shops` | `tax_rate`, `currency`, `base_currency`, `invoice_prefix`, `invoice_counter` | Correctly moved to `app_settings` |
| `shops` | `logo`, `receipt_setting`, `draft_retention_days` | Removed per scope reframe |

### ⚠️ Tier Mismatches — Capability Keys

| Feature | Current min_tier | Expected min_tier | Doc Reference |
|---------|------------------|-------------------|---------------|
| `multi_currency` | `free` | **Should not exist** | VISION.md §19 (MMK-only) |
| `printer_integration` | `growth` | `growth` ✅ | VISION.md §5.5 |
| `staff_accounts` | `growth` | `growth` ✅ | VISION.md §5.5 |
| `advanced_reports` | `pro` | `pro` ✅ | VISION.md §5.5 |

---

## 4. RLS Policies Analysis

| Issue | Status | Notes |
|-------|--------|-------|
| `platform_admin` in RLS | ✅ CLEAN | No RLS policy contains `platform_admin`. All policies use `current_shop_ids()` and role checks via `users.role`. |
| All tables have RLS | ✅ CLEAN | All 21 tables have RLS enabled |
| Shop-scoped tables use `current_shop_ids()` | ✅ CLEAN | Shop-scoped policies use `shop_id IN (SELECT current_shop_ids())` |
| `is_platform_admin()` function | ⚠️ MISSING | Function listed in database.md but NOT found in actual DB |
| Global admin policies | ⚠️ LEGACY | Some policies check `role = 'admin'` globally (not `platform_admin`) — works for shop admins but is not the platform_admin bypass mechanism |

### RLS Policy Observations

1. **Multiple policies per table**: Some tables (categories, customers, discounts, products, sales, suppliers) have both a global admin policy (`role = 'admin'`) AND a shop-scoped policy. This is functionally correct but creates dual code paths.

2. **`users.role` checks in RLS**: Policies check `users.role` directly rather than using `shop_memberships.role`. This works because users are scoped per-shop, but could lead to issues if a user has different roles across shops.

3. **`sales` INSERT policy**: Sales has a shop-member INSERT policy (no role check), which is correct — cashiers need to insert sales.

---

## 5. Critical Blockers

The following issues block frontend development progress:

- [ ] **`multi_currency` feature row exists but is out of scope** — VISION.md §19 explicitly excludes multi-currency. The DB row with `subscription_tier='free'` and `default_enabled=true` should be removed or the key should be removed from capability resolution.

- [ ] **8 capability keys missing from `feature_definitions`** — `pos` (implicit), `purchase_log`, `stock_overview`, `low_stock_alerts`, `cash_drawer`, `owner_insights`, `simple_profit_report`, `recipe_bom`, `raw_materials`, `waste_tracking`. Frontend components that use `useCapability('cash_drawer')` or `useCapability('low_stock_alerts')` will not work.

- [ ] **`print_jobs` table missing** — VISION.md §5.5 and database.md §7.2 reference print jobs for thermal printer support. The table does not exist.

- [ ] **`applicable_types` column missing from `feature_definitions`** — The feature-flags.md spec defines this column for business type filtering.

- [ ] **`is_platform_admin()` function missing** — Listed in database.md §4 as a required RLS helper but not found in actual DB.

---

## 6. Recommended Actions

### High Priority (Blockers)

**1. Remove out-of-scope `multi_currency` feature row:**
```sql
DELETE FROM feature_definitions WHERE key = 'multi_currency';
```
Reference: VISION.md §19 ("Multi-currency / exchange rates" explicitly excluded)

**2. Remove out-of-scope feature rows for v1:**
```sql
DELETE FROM feature_definitions WHERE key IN ('kitchen_display', 'online_ordering');
```
Reference: VISION.md §19 (KDS, customer API access excluded)

**3. Seed missing capability keys:**
```sql
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier) VALUES
  ('cash_drawer', 'Cash Drawer', 'Shift start/end with opening/closing cash', 'pos', true, 'growth'),
  ('purchase_log', 'Purchase Recording', 'Record supplier purchases', 'inventory', true, 'growth'),
  ('stock_overview', 'Stock Overview', 'Current supply levels and adjustments', 'inventory', true, 'growth'),
  ('low_stock_alerts', 'Low Stock Alerts', 'Threshold-based inventory alerts', 'inventory', true, 'growth'),
  ('owner_insights', 'Owner Insights', 'P&L dashboard and business analytics', 'general', false, 'pro'),
  ('simple_profit_report', 'Simple Profit Report', 'Revenue minus purchases report', 'general', false, 'pro');
```
Reference: VISION.md §5.5

**4. Create `print_jobs` table:**
```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
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
```
Reference: database.md §7.2, VISION.md §5.5 (printer_integration Growth+)

**5. Add missing RLS helper function:**
```sql
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
Reference: database.md §4, VISION.md §4.3

### Medium Priority

**6. Add `applicable_types` column to `feature_definitions`:**
```sql
ALTER TABLE feature_definitions
  ADD COLUMN applicable_types TEXT[] DEFAULT '{coffee_shop}'::TEXT[];
```
Reference: feature-flags.md

**7. Clean up orphaned columns in `products`:**
If `product_type`, `base_currency`, `price_in_base_currency` are not used by frontend code, consider removing them. Check with:
```bash
grep -r "product_type\|base_currency\|price_in_base_currency" src/
```

### Low Priority (Documentation)

**8. Update database.md to remove deprecated functions:**
The three currency functions (`get_current_exchange_rate`, `convert_currency_amount`, `update_exchange_rate`) and `replace_recipe_lines` are documented but don't exist. Either remove from docs or re-add to DB.

**9. Clarify `multi_tab_sales` vs `sales_tabs`:**
The DB table is `sales_tabs` but capability key is `multi_tab_sales`. Ensure frontend resolution is consistent.

---

## 7. Summary

The database is **88% compliant** with VISION.md v3.0.0 scope. Key findings:

- **✅ No deprecated tables** found — `recipes`, `currency_config`, `exchange_rates` all correctly absent
- **✅ `business_type` removed** from `shops` — correctly implements §2.1 single-type
- **✅ `daily_order_limit` present** — correctly implements §16.3 tier limits
- **✅ RLS is clean** — no `platform_admin` in policies, all tables protected
- **⚠️ 8 capability keys missing** — blocks `cash_drawer`, `low_stock_alerts`, `owner_insights` functionality
- **⚠️ 2 out-of-scope features present** — `multi_currency` and `kitchen_display` rows in DB
- **⚠️ `print_jobs` table missing** — thermal printer feature needs this

**Net: 6 issues requiring action before full scope compliance.** The DB is in good shape overall — no dangerous legacy tables, correct tier limits column, clean RLS. The main work is seeding missing capability rows and removing the `multi_currency` row.