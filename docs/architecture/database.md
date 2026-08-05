# Database Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last schema migration:** `20260805144623_cashier_role_check.sql`
**Generated:** 2026-06-20
**Reconciled:** 2026-08-05 (schema truth verified against live DB)

> **Multi-tenancy:** The `shop_id` foundation exists with a single default shop and no shop-switching UI yet. Dynamic shop configuration is the next milestone: `shops` owns business identity and POS behavior, while `app_settings` is trimmed to global/preferences-style settings. See `docs/specs/multi-tenancy.md` and `docs/specs/dynamic-configuration.md`.

---

## 1. Tables

> ⚠️ **DEPRECATED TABLES (v3.1.0)** — The following tables **are not present in the database** and are documented here for historical reference only. NOT used in v1.0. Out of scope per VISION.md v3.1.0 §19.
> - `recipes`, `recipe_lines` — Recipe BOM (out of scope, see Purchase Log)
> - `raw_materials` — Raw material tracking (out of scope)
> - `consumption_log` — Consumption tracking (out of scope)
> - `uom_conversions` — Unit conversions (out of scope)
> - `kitchen_orders` — Kitchen display (out of scope, use thermal printer)
> - `currency_config`, `exchange_rates`, `exchange_rate_history` — Multi-currency (out of scope, MMK only per §19)
> - `shop_features` — DROPPED (migration `20260803010000_drop_shop_features`); feature resolution is now tier-only per VISION §5.3
>
> **Table Count (v3.1.0):** 25 active tables (all present in the live database) + 10 deprecated tables (not present in the database; documented above for historical reference per VISION.md §19).
>
> **Note:** For precise counts, run:
> ```bash
> supabase db dump --schema-only | grep -c "CREATE TABLE"
> supabase db dump --schema-only | grep -c "CREATE INDEX"
> supabase db dump --schema-only | grep -c "CREATE FUNCTION"
> ```

### 1.1 Core Business Tables

#### `app_settings`
Shop-level preferences and configuration. One row per shop. Auto-created by `trg_create_default_app_settings` trigger on `shops` INSERT.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK | default shop | Compatibility tenant link and cleanup key |
| `store_name` | text | `'sekaLabs 2025 POS'` | Display name for receipts |
| `store_address` | text | | Physical address for receipts |
| `store_phone` | text | | Contact phone for receipts |
| `store_email` | text | | Contact email |
| `store_logo` | text | | Logo URL or base64 |
| `tax_rate` | numeric | `0.0000` | Tax percentage (0-100) |
| `currency` | text | `'MMK'` | **MMK only** per VISION.md §19. Default aligned to MMK. |
| `interface_mode` | text | `'touch'` | CHECK: `'touch'` \| `'traditional'` |
| `auto_backup` | boolean | `true` | Backup preference |
| `receipt_printer` | boolean | `false` | Printer preference |
| `theme` | text | `'light'` | CHECK: `'light'` \| `'dark'` \| `'auto'` |
| `invoice_prefix` | text | `'INV'` | Invoice number prefix |
| `invoice_counter` | integer | `1000` | Current invoice counter |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `settingsService.get()` and `settingsService.update()` handle all fields in this table.

---

#### `categories`
Product categories. Flat structure (no hierarchy).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | UNIQUE |
| `description` | text | | |
| `active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** No dedicated service. Products reference `category` as TEXT, not FK.

---

#### `products`
Product catalog. Supports weight-based and unit-based pricing.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | |
| `sku` | text NOT NULL | | UNIQUE |
| `barcode` | text | | Nullable, indexed |
| `price` | decimal(10,2) NOT NULL | | CHECK: `>= 0`. Unit price. 0 for weight-based |
| `cost` | decimal(10,2) | | CHECK: `>= 0` |
| `stock` | integer | `0` | CHECK: `>= 0` |
| `min_stock` | integer | `0` | CHECK: `>= 0` |
| `category` | text NOT NULL | | Free text, not FK to `categories` |
| `description` | text | | |
| `image` | text | | Base64 or URL |
| `taxable` | boolean | `true` | |
| `active` | boolean | `true` | Soft delete |
| `is_weight_based` | boolean | `false` | |
| `price_per_unit` | decimal(10,2) | | Per-kg or per-lb price |
| `unit` | text | `'piece'` | `'kg'`, `'lb'`, `'g'`, `'oz'`, `'l'`, `'ml'`, `'piece'` |
| `track_inventory` | boolean | `true` | When false, stock not checked/deducted |
| `product_type` | text | `'finished'` | CHECK: `'finished'` \| `'raw_material'`. Distinguishes menu items from ingredients (Recipe/BOM support, VISION.md v3.1.0 §7). |
| `base_currency` | text | | RESERVED — no default. Added in currency migration |
| `price_in_base_currency` | decimal(10,2) | | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `productsService` — `getAll()` filters `active=true`, returns batches as `[]`. `getBatchesByProductId()` lazy-loads.

---

#### `product_batches`
Manufacturing/expiry tracking per product.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `product_id` | uuid FK | | → `products(id)` ON DELETE CASCADE |
| `batch_number` | text NOT NULL | | |
| `manufacturing_date` | date | | |
| `expiry_date` | date | | Nullable, indexed |
| `quantity` | integer NOT NULL | `0` | CHECK: `>= 0` |
| `cost_price` | decimal(10,2) | | CHECK: `>= 0` |
| `supplier_info` | text | | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Constraints:** UNIQUE(`product_id`, `batch_number`)
**Service:** Accessed via `productsService.getBatchesByProductId(id)`.

---

#### `customers`
Customer records. Credit system built in.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | GIN full-text index |
| `email` | text | | Conditional index (WHERE NOT NULL) |
| `phone` | text | | Conditional index (WHERE NOT NULL) |
| `address` | text | | |
| `credit_limit` | decimal(10,2) | `0.00` | |
| `credit_used` | decimal(10,2) | `0.00` | |
| `price_tier` | text | `'Standard'` | `'Standard'`, `'Premium'`, `'VIP'`, `'Wholesale'` |
| `total_purchases` | decimal(12,2) | `0.00` | Auto-updated by trigger on completed sale |
| `last_purchase` | timestamptz | | Auto-updated by trigger |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `customersService` — `update()` only includes provided fields in SET clause.

---

#### `suppliers`
Supplier records. No direct FK from products (supplier info stored as text in batches).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | |
| `email` | text | | |
| `phone` | text | | |
| `address` | text | | |
| `payment_terms` | text | | |
| `rating` | decimal(2,1) | `5.0` | CHECK: `>= 0 AND <= 5` |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** No dedicated service in `services.ts`. Unused in frontend currently.

---

#### `discounts`
Discount engine. Supports percentage, fixed, and free_gift types.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | |
| `description` | text | | |
| `type` | text NOT NULL | | CHECK: `'percentage'` \| `'fixed'` \| `'free_gift'` |
| `value` | decimal(10,2) | `0` | CHECK: `>= 0`. Percentage or fixed amount |
| `conditions` | jsonb | `'[]'` | Array of DiscountCondition objects |
| `free_gift_products` | text[] | | Array of product IDs (for free_gift type) |
| `min_amount` | decimal(10,2) | | Minimum cart total |
| `max_discount` | decimal(10,2) | | Cap for percentage discounts |
| `valid_from` | timestamptz NOT NULL | | |
| `valid_to` | timestamptz NOT NULL | | CHECK: `valid_to > valid_from` |
| `valid_days` | integer[] | `'{0,1,2,3,4,5,6}'` | CHECK: `@< ARRAY[0..6]`. 0=Sun, 6=Sat |
| `active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**conditions JSONB schema:**
```json
[
  { "type": "min_amount", "value": 1000 },
  { "type": "specific_products", "value": ["<product-uuid>"], "minQuantity": 1 },
  { "type": "payment_method", "value": "card" },
  { "type": "customer_tier", "value": "Premium" },
  { "type": "card_type", "value": "visa" },
  { "type": "bank_name", "value": "Bank of Ceylon" }
]
```

**Service:** `discountsService` — full CRUD.

---

#### `users`
Staff profiles. Extends Supabase `auth.users`.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | | → `auth.users(id)` ON DELETE CASCADE |
| `username` | text NOT NULL | | UNIQUE |
| `name` | text NOT NULL | | |
| `email` | text NOT NULL | | |
| `role` | text NOT NULL | `'cashier'` | CHECK: `'platform_admin'` \| `'admin'` \| `'manager'` \| `'cashier'`. 4 roles (VISION.md v3.1.0 §4). |
| `permissions` | text[] | `'{}'` | Currently unused (role governs access) |
| `active` | boolean | `true` | |
| `last_login` | timestamptz | | |
| `avatar` | text | | URL |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**`users.role` note:** Retained for backward compatibility. The canonical role source is `shop_memberships.role`. The `platform_admin` role does NOT have a `shop_memberships` row — it operates cross-tenant via Edge Functions with `service_role` key.

**Auto-creation:** `handle_new_auth_user()` trigger on `auth.users` INSERT creates:
1. `public.users` row (active=false)
2. `shops` row (is_active=false, business_type='coffee_shop', subscription_tier='free', daily_order_limit=50)
3. `shop_memberships` row (role='admin', is_active=false)

All three remain inactive until `platform_admin` approves via Edge Function. (VISION.md v3.1.0 §6)

**Service:** `usersService` — full CRUD. `AuthContext.loadProfile()` reads directly via `supabase.from('users')`.

---

#### `sales`
Transaction records. JSONB `items` stores cart snapshot at time of sale.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `invoice_number` | text NOT NULL | | UNIQUE. Auto-generated by trigger if empty |
| `customer_id` | uuid FK | | → `customers(id)` ON DELETE SET NULL |
| `customer_name` | text | | Denormalized for snapshot |
| `items` | jsonb NOT NULL | `'[]'` | Array of CartItem snapshots |
| `subtotal` | decimal(12,2) NOT NULL | `0` | CHECK: `>= 0` |
| `discount_amount` | decimal(12,2) | `0` | CHECK: `>= 0` |
| `tax_amount` | decimal(12,2) | `0` | CHECK: `>= 0` |
| `total` | decimal(12,2) NOT NULL | | CHECK: `>= 0` |
| `payment_method` | text | | CHECK: `'cash'` \| `'card'` \| `'digital'` \| `'credit'` \| `'split'` \| `'kbzpay'` \| `'wavepay'` \| `'ayapay'` \| `'cbpay'` \| `'mpu'` |
| `payments` | jsonb | `'[]'` | Split payment breakdown array |
| `card_details` | jsonb | | Bank, card type, last 4 digits (NO cardNumber — purged) |
| `status` | text | `'completed'` | CHECK: `'pending'` \| `'completed'` \| `'refunded'` \| `'credit'` \| `'draft'` |
| `cashier` | text | | Denormalized cashier name |
| `cashier_id` | uuid FK | | → `users(id)`. Structured reference for shift tracking. Existing `cashier` text column retained for backward compat. |
| `cashier_role` | text | | CHECK: `cashier_role IS NULL OR IN ('platform_admin','admin','manager','cashier')` |
| `receipt_number` | text | | |
| `receipt_printed` | boolean | `false` | Whether receipt was printed for this sale (VISION.md v3.1.0 §9). |
| `notes` | text | | |
| `applied_discounts` | jsonb | `'[]'` | Array of AppliedDiscount objects |
| `free_gifts` | jsonb | `'[]'` | Array of CartItem objects |
| `transaction_currency` | text | | RESERVED — no default |
| `base_currency_amount` | decimal(12,2) | | |
| `exchange_rate_used` | decimal(15,8) | | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**CHECK Constraints (verified via `pg_constraint`):**

| Constraint | Definition |
|-----------|-----------|
| `chk_sales_cashier_role` | `cashier_role IS NULL OR cashier_role IN ('platform_admin','admin','manager','cashier')` |
| `sales_amounts_non_negative` | `subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total >= 0` |
| `sales_payment_method_check` | `payment_method IN ('cash','card','digital','credit','split','kbzpay','wavepay','ayapay','cbpay','mpu')` |
| `sales_status_check` | `status IN ('pending','completed','refunded','credit','draft')` |

**Triggers:**
- ~~`trigger_auto_generate_invoice_number`~~ — **DROPPED** (migration m38). Invoice generation now handled inside `checkout_complete()` RPC.
- ~~`trigger_update_customer_stats`~~ — **DROPPED** (migration m39). Customer stats update now handled inside `checkout_complete()` RPC.

**Service:** `salesService` — `getAll()` cursor-based pagination (`limit`, `cursor`). `create()`, `delete()`. No `update()`.

---

#### `sales_tabs`
Multi-tab POS workflow. User-scoped, persisted between sessions.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `user_id` | uuid FK | | → `users(id)` ON DELETE CASCADE |
| `name` | text NOT NULL | | e.g. "Sale 1" |
| `cart` | jsonb | `'[]'` | Array of CartItem objects |
| `selected_customer_id` | uuid FK | | → `customers(id)` ON DELETE SET NULL |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `salesTabsService` — `getByUserId(userId)` joins `customers` table for `selected_customer`. `create(userId, tab)`, `update(id, tab)`, `delete(id)`.

---

### 1.2 Currency Tables ⚠️ DEPRECATED (MMK only in v1)

#### `currency_config`
Supported currencies. Seeded with 11 currencies (USD base + EUR/GBP/CAD/LKR/JPY/AUD/CHF/CNY/INR/MMK).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `code` | text NOT NULL | | UNIQUE. ISO 4217 |
| `name` | text NOT NULL | | |
| `symbol` | text NOT NULL | | |
| `symbol_position` | text | `'before'` | CHECK: `'before'` \| `'after'` |
| `decimal_places` | integer | `2` | CHECK: `>= 0` |
| `is_active` | boolean | `true` | |
| `is_base_currency` | boolean | `false` | Only one row should be true |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

---

#### `exchange_rates` ⚠️ DEPRECATED
Active exchange rates. Versioned via `effective_to` (NULL = current).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `base_currency` | text NOT NULL | | |
| `target_currency` | text NOT NULL | | |
| `rate` | decimal(15,8) NOT NULL | | CHECK: `> 0` |
| `source` | text NOT NULL | `'api'` | `'api'` \| `'manual'` \| `'fallback'` |
| `is_manual_override` | boolean | `false` | |
| `effective_from` | timestamptz NOT NULL | `now()` | |
| `effective_to` | timestamptz | | NULL = currently active |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Constraints:** UNIQUE(`base_currency`, `target_currency`, `effective_from`), CHECK(`effective_to IS NULL OR effective_to > effective_from`)

---

#### `exchange_rate_history`
Audit trail for rate changes.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `base_currency` | text NOT NULL | | |
| `target_currency` | text NOT NULL | | |
| `rate` | decimal(15,8) NOT NULL | | CHECK: `> 0` |
| `previous_rate` | decimal(15,8) | | CHECK: `> 0` if not null |
| `change_percentage` | decimal(8,4) | | |
| `source` | text NOT NULL | `'api'` | |
| `is_manual_override` | boolean | `false` | |
| `recorded_at` | timestamptz | `now()` | NOT NULL |

---

## 2. Foreign Key Map

```
auth.users
  └── users.id (CASCADE)

products
  ├── product_batches.product_id (CASCADE)
  └── discounts.free_gift_products (TEXT[] — no FK, soft reference)

customers
  ├── sales.customer_id (SET NULL)
  └── sales_tabs.selected_customer_id (SET NULL)

users
  ├── sales_tabs.user_id (CASCADE)
  ├── sales.cashier_id
  ├── cash_shifts.cashier_id
  └── shop_invitations.invited_by

shops
  ├── shop_memberships.shop_id (CASCADE)
  ├── print_jobs.shop_id
  ├── cash_shifts.shop_id
  ├── alert_recipients.shop_id
  ├── alert_templates.shop_id
  ├── alert_configurations.shop_id
  ├── alert_history.shop_id
  ├── notification_service_config.shop_id
  ├── shop_invitations.shop_id
  └── (all 13 original tables via shop_id)

sales
  └── print_jobs.order_id
```

**⚠️ Deprecated FKs (v3.1.0 — out of scope per §19):**
```
recipes
  ├── products.product_id (finished product)     — DEPRECATED
  ├── shops.shop_id                              — DEPRECATED
  └── recipe_items.recipe_id (CASCADE)           — DEPRECATED

recipe_items
  └── raw_materials.id (raw material)            — DEPRECATED

consumption_log
  ├── products.product_id (finished product)     — DEPRECATED
  ├── products.ingredient_id (raw material)      — DEPRECATED
  ├── sales.sale_id                              — DEPRECATED
  └── shops.shop_id                              — DEPRECATED

currency_config, exchange_rates, exchange_rate_history  — DEPRECATED (MMK only)
```

**Soft references (no FK constraint):**
- `products.category` → `categories.name` (text match, no FK)
- `discounts.conditions[].value` → product IDs (jsonb array, no FK)
- `sales.items[].product.id` → product snapshot at sale time (no FK)
- `discounts.free_gift_products` → product IDs (text[], no FK)

---

## 3. Index Inventory

### Products
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_products_sku` | `sku` | B-tree | |
| `idx_products_barcode` | `barcode` | Partial | `WHERE barcode IS NOT NULL` |
| `idx_products_category` | `category` | B-tree | |
| `idx_products_active` | `active` | B-tree | |
| `idx_products_name_search` | `name` | GIN | Full-text search |
| `idx_products_category_active` | `category, active` | Composite | |

### Customers
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_customers_name` | `name` | GIN | Full-text search |
| `idx_customers_email` | `email` | Partial | `WHERE email IS NOT NULL` |
| `idx_customers_phone` | `phone` | Partial | `WHERE phone IS NOT NULL` |
| `idx_customers_name_text` | `name` | B-tree | `text_pattern_ops` for LIKE |

### Sales
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_sales_timestamp` | `created_at` | B-tree | |
| `idx_sales_customer_id` | `customer_id` | B-tree | |
| `idx_sales_invoice_number` | `invoice_number` | B-tree | |
| `idx_sales_status` | `status` | B-tree | |
| `idx_sales_payment_method` | `payment_method` | B-tree | |
| `idx_sales_cashier` | `cashier` | B-tree | |
| `idx_sales_created_at_status` | `created_at, status` | Composite | |

### Product Batches
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_product_batches_product_id` | `product_id` | B-tree | |
| `idx_product_batches_expiry` | `expiry_date` | Partial | `WHERE expiry_date IS NOT NULL` |
| `idx_product_batches_batch_number` | `batch_number` | B-tree | |

### Discounts
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_discounts_active` | `active` | B-tree | |
| `idx_discounts_validity` | `valid_from, valid_to` | Partial | `WHERE active = true` |
| `idx_discounts_type` | `type` | B-tree | |

### Users
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_users_username` | `username` | B-tree | |
| `idx_users_email` | `email` | B-tree | |
| `idx_users_role` | `role` | B-tree | |
| `idx_users_active` | `active` | B-tree | |

### Sales Tabs
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_sales_tabs_user_id` | `user_id` | B-tree | |

### Missing Indexes (Identified)

| Table | Column | Why Needed |
|-------|--------|------------|
| `sales` | `payments` | GIN for JSONB search by payment method in split payments |
| `app_settings` | (none) | Single-row table, not needed |

---

## 4. Functions

| Function | Security | Purpose | Trigger? |
|----------|----------|---------|----------|
| `update_updated_at_column()` | SECURITY DEFINER | Sets `updated_at = now()` on UPDATE | Yes — all tables with `updated_at` |
| `generate_invoice_number()` | INVOKER, `search_path=''` | Reads `app_settings.invoice_prefix`/`invoice_counter`, increments counter, returns formatted invoice number | No — called by `checkout_complete()` RPC (trigger path dropped in m38) |
| `handle_new_auth_user()` | SECURITY DEFINER, `search_path=''` | Creates `public.users` + `shops` + `shop_memberships` rows on `auth.users` insert | Yes — AFTER INSERT on `auth.users` |
| `handle_new_shop_app_settings()` | SECURITY DEFINER, `search_path=''` | Auto-creates `app_settings` row for newly inserted shops. Inserts with defaults: `interface_mode='touch'`, `theme='light'`, `auto_backup=true`, `invoice_prefix=COALESCE(shop.invoice_prefix,'INV')`, `invoice_counter=COALESCE(shop.invoice_counter,1000)`. Ensures 1:1 data integrity between shops and app_settings. | Yes — AFTER INSERT on `shops` |
| `get_current_exchange_rate(text, text)` | INVOKER, `search_path=''` | **DEPRECATED (v3.1.0).** Returns current rate between two currencies. MMK-only — no multi-currency. | No — called from app |
| `convert_currency_amount(decimal, text, text)` | INVOKER, `search_path=''` | **DEPRECATED (v3.1.0).** Converts amount using current rate. MMK-only — no multi-currency. | No — called from app |
| `update_exchange_rate(text, text, decimal, text, boolean)` | INVOKER, `search_path=''` | **DEPRECATED (v3.1.0).** Ends current rate, inserts new, records history. MMK-only — no multi-currency. | No — called from app |
| `rls_auto_enable()` | SECURITY DEFINER | Auto-enables RLS. Revoked from client roles | Event trigger |
| `checkout_complete(uuid, jsonb, jsonb, uuid)` | SECURITY DEFINER, `search_path='public'` | Atomic all-or-nothing checkout transaction. Race condition protection via `SELECT ... FOR UPDATE` on shops row. Checks `daily_order_limit`, generates invoice, inserts sale, deducts inventory (product stock only), updates customer stats. RAISES `DAILY_LIMIT_REACHED` if limit exceeded. | No — called via `supabase.rpc()` |
| `current_shop_ids()` | INVOKER, `search_path=''` | Returns shop IDs where current user has active membership. Used in RLS policies for shop-scoped access. | No — called in RLS policies |
| `is_platform_admin()` | SECURITY DEFINER | Checks if `auth.uid()` maps to a user with `role = 'platform_admin'`. Used in RLS for cross-tenant access. | No — called in RLS policies |
| `replace_recipe_lines(uuid, jsonb)` | SECURITY DEFINER | **DEPRECATED (v3.1.0).** Atomically deletes existing recipe_lines for a recipe and inserts new lines. Was used by recipe BOM management — BOM removed from v1 scope. | No — called via RPC |
| `auto_generate_invoice_number()` | INVOKER, `search_path=''` | Auto-increment invoice counter. Reads current counter from `shops.invoice_counter`, increments atomically, returns formatted invoice number. Used inside `checkout_complete()` RPC. | No — called by `checkout_complete()` RPC |
| `check_inventory_alerts()` | INVOKER, `search_path=''` | Alert system: checks product stock levels against configured thresholds in `alert_configurations`. Returns products that breach low-stock or out-of-stock thresholds. | No — called by pg_cron or Edge Function |
| `deduct_product_stock(uuid, integer)` | SECURITY DEFINER, `search_path=''` | Deducts stock during checkout. Decrements `products.stock` by the given quantity for the specified product. Includes `CHECK (stock >= 0)` guard. Called inside `checkout_complete()` RPC for inventory-tracked products. | No — called by `checkout_complete()` RPC |
| `get_alert_recipients(uuid)` | INVOKER, `search_path=''` | Alert system: returns active alert recipients for a given shop. Filters by `shop_id` and `is_active = true`. Returns recipient contact info and alert type preferences. | No — called by Edge Function |
| `should_send_alert(uuid, text)` | INVOKER, `search_path=''` | Alert system: throttling check. Returns `true` if no alert of the given type was sent to the shop within the configured cooldown window (`alert_configurations.cooldown_minutes`, default 24h). Prevents duplicate alert floods. | No — called by Edge Function |
| `update_customer_stats(uuid, decimal)` | SECURITY DEFINER, `search_path=''` | Updates customer purchase totals. Increments `customers.total_purchases` by the sale total and sets `customers.last_purchase` to `now()`. Called inside `checkout_complete()` RPC. | No — called by `checkout_complete()` RPC |
| `provision_user(uuid, uuid, uuid, text, text)` | SECURITY DEFINER, `search_path=''` | Atomic user provisioning. Upserts `shop_memberships`, marks invitation accepted (if token flow), and inserts to `audit_logs` — all in one transaction. Role is read from invitation when token is present (prevents privilege escalation). Called by Edge Functions after `auth.admin.createUser()`. Revoked from `anon`/`authenticated`. VISION.md §6. Related: `docs/specs/technical-debt.md §6` (replaces sequential writes pattern). | No — called via `supabase.rpc()` by Edge Functions |
| `approve_shop(uuid, uuid)` | SECURITY DEFINER, `search_path=''` | Atomic shop approval. Validates shop exists and is inactive, validates approver is platform_admin, gets admin membership, then atomically updates `shops.is_active`, `shop_memberships.is_active`, and `users.active` in one transaction. Inserts audit log entry. Called by `platform-admin-approve-shop` Edge Function. Revoked from `anon`/`authenticated`. Resolves `docs/specs/technical-debt.md §6`. | No — called via `supabase.rpc()` by Edge Functions |
| `reject_shop(uuid, uuid, text)` | SECURITY DEFINER, `search_path=''` | Atomic shop rejection. Validates shop exists and is inactive, validates approver is platform_admin, then deletes the shop and related rows in one transaction. Inserts audit log entry with rejection reason. Called by `platform-admin-reject-shop` Edge Function. Revoked from `anon`/`authenticated`. | No — called via `supabase.rpc()` by Edge Functions |
| `has_capability(uuid, text)` | SECURITY DEFINER, `search_path=''` | Checks if a shop has a specific capability key via `resolve_capabilities()`. Used in RLS policies for capability-gated access. | No — called in RLS policies |
| `count_shop_memberships(uuid)` | SECURITY DEFINER, `search_path=''` | Returns count of active members in a shop. Used to enforce free-tier member limits. | No — called via RPC |
| `enforce_free_tier_product_limit()` | SECURITY DEFINER, `search_path=''` | Trigger function: BLOCKS product inserts when shop is at free-tier product limit (50 products). RAISES exception if limit exceeded. | Yes — BEFORE INSERT on `products` |
| `is_shop_admin(uuid)` | SECURITY DEFINER, `search_path=''` | Returns `true` if the current user has `admin` role in the given shop. Used in RLS policies for admin-only operations. | No — called in RLS policies |
| `is_shop_admin_or_manager(uuid)` | SECURITY DEFINER, `search_path=''` | Returns `true` if the current user has `admin` or `manager` role in the given shop. Used in RLS policies for write operations. | No — called in RLS policies |
| `reserve_invoice_number(uuid)` | SECURITY DEFINER, `search_path='public'` | Reserves an invoice number atomically. Increments `shops.invoice_counter` and returns the formatted invoice number. Called by `checkout_complete()` RPC. | No — called by `checkout_complete()` RPC |
| `resolve_capabilities(uuid)` | SECURITY DEFINER, `search_path=''` | Resolves feature capabilities for a shop based on its subscription tier. Queries `feature_definitions` filtered by tier. Used by `has_capability()` and the app context loader. | No — called via RPC |
| `users_get_own_active()` | SECURITY DEFINER, `search_path=''` | Returns `true` if the current user (`auth.uid()`) has `active = true` in the `users` table. Used in RLS policies to gate access for inactive/pending users. | No — called in RLS policies |
| `users_get_own_role()` | SECURITY DEFINER, `search_path=''` | Returns the current user's role from the `users` table. Used in RLS policies and app context. | No — called in RLS policies |
| `users_get_own_shop_id()` | SECURITY DEFINER, `search_path=''` | Returns the current user's `shop_id` from the `users` table. Used in RLS policies and app context for single-shop users. | No — called in RLS policies |

---

## 5. RLS Policy Summary

**Pattern:** All tables have RLS enabled. Policies use shop-scoped role-aware pattern.

**`platform_admin` rule:** NEVER appears in RLS policies. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions. No `OR users.role = 'platform_admin'` in any policy. (VISION.md v3.1.0 §4.3)

**RLS helper:** `current_shop_ids()` returns `uuid[]` of shops where the current user has active membership. Used in all shop-scoped policies.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `app_settings` | Shop members | admin/manager | admin/manager | admin/manager |
| `categories` | Shop members | admin/manager | admin/manager | admin/manager |
| `customers` | Shop members | admin/manager | admin/manager | admin/manager |
| `suppliers` | Shop members | admin/manager | admin/manager | admin/manager |
| `products` | Shop members | admin/manager | admin/manager | admin/manager |
| `product_batches` | Shop members | admin/manager | admin/manager | admin/manager |
| `discounts` | Shop members | admin/manager | admin/manager | admin/manager |
| `users` | All authenticated | All authenticated | Self OR admin | (none — no DELETE policy) |
| `sales` | Shop members | Shop members | admin/manager | admin/manager |
| `sales_tabs` | Own tabs only | Own tabs only | Own tabs only | Own tabs only |
| `feature_definitions` | All authenticated | (Edge Function only) | (Edge Function only) | (Edge Function only) |
| `print_jobs` | Shop members | (RPC/Edge Function) | (Edge Function) | (none) |
| `cash_shifts` | Shop members | cashier+ (own) | cashier+ (own) | admin/manager |
| `shop_invitations` | Invited user (own) OR admin/manager (all) | admin/manager | admin/manager | (none — service_role only) |

**Shop-scoped SELECT policy pattern:**
```sql
CREATE POLICY "shop_member_select" ON <table>
FOR SELECT USING (
  shop_id = ANY(current_shop_ids())
);
```

**Shop-scoped INSERT/UPDATE policy pattern (admin/manager):**
```sql
CREATE POLICY "shop_admin_write" ON <table>
FOR INSERT WITH CHECK (
  shop_id = ANY(current_shop_ids())
  AND EXISTS (
    SELECT 1 FROM shop_memberships
    WHERE user_id = auth.uid()
      AND shop_id = <table>.shop_id
      AND role IN ('admin', 'manager')
      AND is_active = true
  )
);
```

**Notable:**
- `users` UPDATE: `(auth.uid() = id) OR EXISTS (admin user)` — self-edit or admin
- `users` INSERT: `auth.role() = 'authenticated'` — trigger handles profile creation
- `users` DELETE: No policy defined (implicit deny — no one can delete users via RLS)
- `sales_tabs`: Only `user_id = auth.uid()` — complete user isolation
- `sales`: Cashiers can INSERT (record transactions) but not UPDATE/DELETE
- `print_jobs`: INSERT via `checkout_complete` RPC, UPDATE via Edge Function (pg_cron worker)
- `feature_definitions`: Managed exclusively by `platform_admin` via Edge Functions

---

## 6. Multi-Tenancy Tables (Migration 20260620000001)

### 6.1 `shops`

`shops` owns business identity and per-shop POS behavior.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `name` | text NOT NULL | | Store/business name |
| `address` | text | | Receipt/store address |
| `phone` | text | | Receipt/store phone |
| `email` | text | | Receipt/store email |
| `logo` | text | | Store logo, base64 or URL |
| `owner_id` | uuid | | Future: link to auth.users |
| `business_type` | text | `'coffee_shop'` | CHECK: `'coffee_shop'` only (v1). Restaurant/food_court are v2 planned. Pharmacy/retail/supermarket permanently excluded. |
| `tax_rate` | numeric(5,4) | `0.0000` | Per-shop tax rate |
| `currency` | text | `'MMK'` | Per-shop display currency |
| `base_currency` | text | `'MMK'` | Per-shop base currency for pricing |
| `invoice_prefix` | text | `'INV'` | Invoice prefix |
| `invoice_counter` | integer | `1000` | Mutated only by atomic invoice DB function |
| `draft_retention_days` | integer | `30` | Cleanup retention for draft sales |
| `subscription_tier` | text | `'free'` | CHECK: `'free'` \| `'growth'` \| `'pro'`. 3-tier model (VISION.md v3.1.0 §3). |
| `daily_order_limit` | integer | `50` | Free tier: 50. Growth/Pro: NULL (unlimited). Enforced in `checkout_complete` RPC. (VISION.md v3.1.0 §16) |
| `receipt_setting` | text | `'ask'` | CHECK: `'always'` \| `'ask'` \| `'never'`. Growth+ only. Controls post-checkout receipt prompt. |
| `is_active` | boolean | `true` | Pending approval keeps this false |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Default shop:** `4f3dab19-144e-4a29-95a5-2ee82f160ce5` — seeded from existing store data.

**Rule:** Store identity, tax/currency behavior, invoice configuration, business type, and draft retention belong here, not in `app_settings`.

---

### 6.2 `shop_memberships`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `user_id` | uuid FK NOT NULL | | → `users(id)` ON DELETE CASCADE |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` ON DELETE CASCADE |
| `role` | text NOT NULL | `'cashier'` | CHECK: `'admin'` \| `'manager'` \| `'cashier'`. Per-shop role. |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Constraints:** UNIQUE(`user_id`, `shop_id`)
**Seeded:** All existing users as members of default shop with their current role.

---

### 6.3 Alert Tables (born with shop_id)

#### `alert_recipients`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | default shop | → `shops(id)` |
| `name` | text NOT NULL | | |
| `email` | text | | |
| `phone` | text | | |
| `role` | text NOT NULL | `'manager'` | CHECK: `'admin'` \| `'manager'` \| `'cashier'` |
| `alert_types` | text[] | `'{"low_stock", "out_of_stock"}'` | |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

#### `alert_templates`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | default shop | → `shops(id)` |
| `name` | text NOT NULL | | |
| `type` | text NOT NULL | | CHECK: `'low_stock'` \| `'out_of_stock'` \| `'reorder'` \| `'expiry_warning'` \| `'batch_expiry'` |
| `channel` | text NOT NULL | `'email'` | CHECK: `'email'` \| `'sms'` \| `'both'` |
| `subject` | text | | |
| `body` | text NOT NULL | | |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

#### `alert_configurations`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | default shop | → `shops(id)` |
| `alert_type` | text NOT NULL | | CHECK: same as alert_templates.type |
| `is_enabled` | boolean | `true` | |
| `threshold_value` | integer | `150` | Percentage of min_stock |
| `check_frequency_minutes` | integer | `60` | |
| `cooldown_minutes` | integer | `1440` | 24 hours |
| `email_template_id` | uuid | | |
| `sms_template_id` | uuid | | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

#### `alert_history`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | default shop | → `shops(id)` |
| `alert_type` | text NOT NULL | | CHECK: same as above |
| `product_id` | uuid | | |
| `product_name` | text | | |
| `product_sku` | text | | |
| `current_stock` | integer | | |
| `min_stock` | integer | | |
| `threshold_value` | integer | | |
| `recipient_id` | uuid | | |
| `recipient_name` | text | | |
| `recipient_email` | text | | |
| `recipient_phone` | text | | |
| `channel` | text | | CHECK: `'email'` \| `'sms'` |
| `status` | text | `'pending'` | CHECK: `'pending'` \| `'sent'` \| `'failed'` \| `'delivered'` |
| `template_id` | uuid | | |
| `message_content` | text | | |
| `error_message` | text | | |
| `sent_at` | timestamptz | | |
| `delivered_at` | timestamptz | | |
| `created_at` | timestamptz | `now()` | NOT NULL |

#### `notification_service_config`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | default shop | → `shops(id)` |
| `service_name` | text NOT NULL | | `'sendgrid'`, `'twilio'`, `'aws_ses'` |
| `service_type` | text NOT NULL | `'email'` | CHECK: `'email'` \| `'sms'` \| `'both'` |
| `config_data` | jsonb | `'{}'` | API keys, endpoints |
| `is_active` | boolean | `true` | |
| `is_default` | boolean | `false` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

### 6.4 shop_id Column Added To (all 13 existing tables)

Every existing table now has:
```sql
shop_id UUID NOT NULL DEFAULT '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid REFERENCES shops(id)
```

Tables: `app_settings`, `categories`, `customers`, `suppliers`, `products`, `product_batches`, `discounts`, `users`, `sales`, `sales_tabs`, `currency_config`, `exchange_rates`, `exchange_rate_history`

### 6.5 shop_id Indexes

| Index | Table | Type |
|-------|-------|------|
| `idx_app_settings_shop_id` | app_settings | B-tree |
| `idx_categories_shop_id` | categories | B-tree |
| `idx_customers_shop_id` | customers | B-tree |
| `idx_suppliers_shop_id` | suppliers | B-tree |
| `idx_products_shop_id` | products | B-tree |
| `idx_product_batches_shop_id` | product_batches | B-tree |
| `idx_discounts_shop_id` | discounts | B-tree |
| `idx_users_shop_id` | users | B-tree |
| `idx_sales_shop_id` | sales | B-tree |
| `idx_sales_tabs_shop_id` | sales_tabs | B-tree |
| `idx_sales_shop_created_at` | sales | Composite (shop_id, created_at) |
| `idx_products_shop_active` | products | Composite (shop_id, active) |
| `idx_customers_shop_name` | customers | Composite (shop_id, name) |
| `idx_sales_tabs_shop_user` | sales_tabs | Composite (shop_id, user_id) |
| `idx_shop_memberships_user_id` | shop_memberships | B-tree |
| `idx_shop_memberships_shop_id` | shop_memberships | B-tree |
| `idx_shop_memberships_user_shop` | shop_memberships | Composite (user_id, shop_id) |
| `idx_alert_recipients_shop_id` | alert_recipients | B-tree |
| `idx_alert_templates_shop_id` | alert_templates | B-tree |
| `idx_alert_configurations_shop_id` | alert_configurations | B-tree |
| `idx_alert_history_shop_id` | alert_history | B-tree |
| `idx_notification_service_config_shop_id` | notification_service_config | B-tree |

### 6.6 RLS on New Tables (Temporary — Chunk 1)

All 7 new tables have RLS enabled with **temporary permissive policies** (`auth.role() = 'authenticated'` for all operations). These will be replaced with role-aware policies in Chunk 2.

| Table | Current Policy | Chunk 2 Target |
|-------|---------------|----------------|
| `shops` | All authenticated (full access) | SELECT: member of shop. Write: admin of shop. |
| `shop_memberships` | All authenticated (full access) | SELECT: member of shop. Write: admin of shop. |
| `alert_recipients` | All authenticated (full access) | SELECT: all authenticated. Write: admin/manager. |
| `alert_templates` | All authenticated (full access) | SELECT: all authenticated. Write: admin/manager. |
| `alert_configurations` | All authenticated (full access) | SELECT: all authenticated. Write: admin/manager. |
| `alert_history` | All authenticated (full access) | SELECT: all authenticated. Write: admin/manager. |
| `notification_service_config` | All authenticated (full access) | SELECT: all authenticated. Write: admin/manager. |

---

## 7. Feature Flag, Recipe, Printer & Cash Drawer Tables

> Added 2026-06-29. Aligned with VISION.md v3.1.0 §§5, 8, 9, 10, 12.

### 7.1 `feature_definitions`

Platform-level feature catalog. Managed exclusively by `platform_admin` via Edge Functions.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `key` | text NOT NULL | | UNIQUE. e.g. `'printer_integration'`, `'purchase_log'` |
| `name` | text NOT NULL | | Human-readable name |
| `description` | text | | |
| `category` | text NOT NULL | `'general'` | |
| `default_enabled` | boolean NOT NULL | `true` | |
| `subscription_tier` | text NOT NULL | `'free'` | CHECK: `'free'` \| `'growth'` \| `'pro'` |
| `applicable_types` | text[] | `'{coffee_shop}'` | Business types this feature applies to |
| `created_at` | timestamptz NOT NULL | `now()` | |

> **v1 Note:** All shops are `coffee_shop` — `applicable_types` is dormant.
> Will activate when v2 adds `restaurant`/`food_court` business types (VISION.md §2.2).
> The Feature Catalog UI is hidden in v1 (VISION.md §5.3 — Gate 2 is dormant).

---

### 7.2 `shop_features` ⚠️ DROPPED

Per-shop feature overrides. **Dropped in migration `20260803010000_drop_shop_features`** — feature resolution is now tier-only per VISION §5.3. No longer present in the live database.

---

### 7.3 `recipes` ⚠️ DEPRECATED

Bill of Materials (BOM) header. Links a finished product to its recipe. Growth+ only (VISION.md v3.0.0 Section 10).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `product_id` | uuid FK NOT NULL | | → `products(id)` — the finished product |
| `product_name` | text NOT NULL | | Denormalized product name |
| `serving_size` | numeric(10,2) | `1` | |
| `serving_unit` | text | `'serving'` | |
| `prep_time_seconds` | integer | | |
| `instructions` | text | | |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Constraint:** UNIQUE(`product_id`) — one recipe per finished product

---

### 7.4 `recipe_lines` ⚠️ DEPRECATED

Recipe line items. Each row is one ingredient in a recipe. Note: DB uses `recipe_lines` (not `recipe_items`).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `recipe_id` | uuid FK NOT NULL | | → `recipes(id)` ON DELETE CASCADE |
| `raw_material_id` | uuid FK NOT NULL | | → `raw_materials(id)` |
| `raw_material_name` | text NOT NULL | | Denormalized raw material name |
| `quantity` | numeric(10,3) NOT NULL | | e.g. 18.000 grams |
| `recipe_unit` | text | | Unit in recipe context |
| `recipe_quantity` | numeric(10,3) | | |
| `wastage_percent` | numeric(5,2) | `0` | |
| `is_optional` | boolean | `false` | |
| `notes` | text | | |
| `created_at` | timestamptz | `now()` | NOT NULL |

---

### 7.5 `consumption_log` ⚠️ DEPRECATED

Logs actual ingredient consumption per sale. Used for COGS calculation. Inserted by `checkout_complete` RPC.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `sale_id` | uuid FK NOT NULL | | → `sales(id)` |
| `sale_item_index` | integer | | Position of item in sale (1-based) |
| `product_id` | uuid FK NOT NULL | | → `products(id)` — finished product sold |
| `product_name` | text NOT NULL | | Denormalized product name |
| `raw_material_id` | uuid FK NOT NULL | | → `raw_materials(id)` |
| `raw_material_name` | text NOT NULL | | Denormalized raw material name |
| `quantity_consumed` | numeric(12,3) NOT NULL | | Actual quantity consumed (with wastage) |
| `quantity_base` | numeric(12,3) NOT NULL | | Base quantity (without wastage) |
| `wastage_amount` | numeric(12,3) | `0` | Quantity wasted |
| `unit` | text NOT NULL | | |
| `stock_before` | numeric(12,3) NOT NULL | | Raw material stock before deduction |
| `stock_after` | numeric(12,3) NOT NULL | | Raw material stock after deduction |
| `consumed_at` | timestamptz | `now()` | NOT NULL |

---

### 7.6 `print_jobs`

Print job queue for thermal printers. Growth+ only (VISION.md v3.1.0 §8). Table scaffold for printer integration (not yet wired into UI or Edge Functions in v1).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` ON DELETE CASCADE |
| `order_id` | uuid FK | | → `sales(id)` ON DELETE SET NULL |
| `status` | text NOT NULL | `'pending'` | CHECK: `'pending'` \| `'printing'` \| `'completed'` \| `'failed'` |
| `config_data` | jsonb NOT NULL | `'{}'` | Formatted print config |
| `created_at` | timestamptz NOT NULL | `now()` | |
| `completed_at` | timestamptz | | |

---

### 7.7 `cash_shifts`

Cash drawer shift tracking. Growth+ only (VISION.md v3.1.0 §12).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `cashier_id` | uuid FK NOT NULL | | → `users(id)` |
| `opening_cash` | numeric(12,2) NOT NULL | | Physical count at shift start |
| `closing_cash` | numeric(12,2) | | Physical count at shift end |
| `expected_cash` | numeric(12,2) | | Opening + Cash Sales - Cash Refunds |
| `variance` | numeric(12,2) | | Actual - Expected |
| `status` | text NOT NULL | `'open'` | CHECK: `'open'` \| `'closed'` |
| `opened_at` | timestamptz NOT NULL | `now()` | |
| `closed_at` | timestamptz | | |

---

### 7.8 New Table Indexes

| Index | Table | Column(s) | Type | Notes |
|-------|-------|-----------|------|-------|
| `idx_feature_definitions_key` | feature_definitions | `key` | B-tree (UNIQUE) | |
| `idx_feature_definitions_category` | feature_definitions | `category` | B-tree | |
| `idx_print_jobs_status` | print_jobs | `status` | B-tree | |
| `idx_print_jobs_shop_id` | print_jobs | `shop_id` | B-tree | |
| `idx_print_jobs_shop_status` | print_jobs | `shop_id, status` | Composite | |
| `idx_print_jobs_order_id` | print_jobs | `order_id` | B-tree | |
| `idx_print_jobs_created_at` | print_jobs | `created_at` | B-tree | DESC |
| `idx_cash_shifts_status` | cash_shifts | `status` | B-tree | |
| `idx_cash_shifts_shop_id` | cash_shifts | `shop_id` | B-tree | |
| `idx_cash_shifts_cashier_id` | cash_shifts | `cashier_id` | B-tree | |
| `idx_cash_shifts_opened_at` | cash_shifts | `opened_at` | B-tree | DESC |
| `idx_stock_items_shop_id` | stock_items | `shop_id` | B-tree | |
| `idx_stock_items_shop_name` | stock_items | `shop_id, name` | Composite | |
| `idx_stock_items_name` | stock_items | `name` | B-tree | |
| `idx_stock_items_low_threshold` | stock_items | `low_threshold` | B-tree | |
| `idx_stock_adj_stock_item_id` | stock_adjustments | `stock_item_id` | B-tree | |
| `idx_stock_adj_shop_id` | stock_adjustments | `shop_id` | B-tree | |
| `idx_stock_adj_item_date` | stock_adjustments | `stock_item_id, adjusted_at` | Composite | DESC |
| `idx_stock_adj_adjusted_at` | stock_adjustments | `adjusted_at` | B-tree | DESC |
| `idx_purchase_logs_shop_id` | purchase_logs | `shop_id` | B-tree | |
| `idx_purchase_logs_shop_date` | purchase_logs | `shop_id, purchase_date` | Composite | DESC |
| `idx_purchase_logs_date` | purchase_logs | `purchase_date` | B-tree | DESC |
| `idx_purchase_logs_item` | purchase_logs | `item` | B-tree | |
| `idx_purchase_logs_supplier` | purchase_logs | `supplier` | B-tree | |

---

### 7.9 `audit_logs`

Platform admin action audit trail. All writes go through Edge Functions using `service_role` key (bypasses RLS). No client-side access.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `actor_id` | uuid FK NOT NULL | | → `users(id)`. Platform admin who performed action |
| `action` | text NOT NULL | | Action name (e.g., `approve_shop`, `reject_shop`) |
| `target_type` | text NOT NULL | | Entity type (shop, user, feature, subscription) |
| `target_id` | uuid | | UUID of target entity (nullable for global actions) |
| `shop_id` | uuid FK | | → `shops(id)`. Shop context (nullable for cross-tenant actions) |
| `details` | jsonb NOT NULL | `'{}'` | Old/new values, reason, metadata |
| `ip_address` | text | | Caller IP from X-Forwarded-For header |
| `created_at` | timestamptz NOT NULL | `now()` | |

**Indexes:**
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_audit_logs_actor_id` | `actor_id` | B-tree | |
| `idx_audit_logs_action` | `action` | B-tree | |
| `idx_audit_logs_target` | `target_type, target_id` | Composite | |
| `idx_audit_logs_shop_id` | `shop_id` | Partial | `WHERE shop_id IS NOT NULL` |
| `idx_audit_logs_created_at` | `created_at` | B-tree | DESC |

**RLS:** Enabled, but no policies (implicit deny for all authenticated/anonymous roles). Only `service_role` can access via Edge Functions.

**Usage:** Platform admin operations (VISION.md §17) log actions here for audit trail.

---

### 7.10 `shop_invitations`

Pending staff invitations. Part of the Onboarding Pipeline (VISION.md §6, Stage 1: INVITE).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)`. Tenant isolation per §18.2 |
| `email` | text NOT NULL | | Email of the invited user |
| `role` | text NOT NULL | `'cashier'` | Role on acceptance. CHECK: `'admin'` \| `'manager'` \| `'cashier'` |
| `token` | text NOT NULL UNIQUE | | Cryptographically random token, shared via invite link |
| `expires_at` | timestamptz NOT NULL | | Invitation expiry timestamp |
| `accepted_at` | timestamptz | | NULL = pending. Set on acceptance |
| `invited_by` | uuid FK NOT NULL | | → `users(id)`. Admin who created the invitation |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Design decision — Invitation as source of truth for role:** When `provision_user()` is called with a token, the role is read from `shop_invitations.role`, not from the `p_role` parameter. This prevents privilege escalation — a caller cannot request a higher role than what the invitation authorizes.

**RLS:**
| Policy | Rule |
|--------|------|
| SELECT (own invitation) | `invited_user_select_own`: invited user (where `email = auth.email()`) can see their own invitation including token |
| SELECT (all) | `admin_manager_select_all`: shop admin/manager can see all invitations for their shop |
| INSERT | `admin_insert`: shop admin/manager |
| UPDATE | `admin_update`: shop admin/manager |
| DELETE | None (implicit deny) — only platform_admin via Edge Function |

**Indexes:**
| Index | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| `idx_shop_invitations_shop_id` | `shop_id` | B-tree | |
| `idx_shop_invitations_token` | `token` | B-tree | Token lookup on acceptance |
| `idx_shop_invitations_email` | `email` | B-tree | Duplicate check |
| `idx_shop_invitations_expires_at` | `expires_at` | B-tree | Stale cleanup |
| `idx_shop_invitations_pending` | `shop_id, email` | Partial | `WHERE accepted_at IS NULL` |

**Service:** `shopInvitationsService` (Phase 2 — frontend implementation).

---

### 7.11 Simplified Inventory Tables (Growth+)

Added per VISION.md v3.1.0 §10 (Simplified Inventory Model). Growth+ only —
capability keys `purchase_log` and `stock_overview` (VISION.md §5.5). Manual
entry model: no recipe BOM, no auto-deduction, no per-drink COGS.

#### `purchase_logs`

Owner-recorded supply purchases (date, supplier, item, quantity, cost).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)`. Tenant isolation per §18.2 |
| `item` | text NOT NULL | | Item description |
| `supplier` | text | | Supplier name (optional) |
| `quantity` | numeric NOT NULL | | CHECK: >= 0 |
| `unit` | text | | e.g. kg, L, piece |
| `unit_cost` | numeric NOT NULL | | CHECK: >= 0 |
| `total_cost` | numeric | | GENERATED column (quantity × unit_cost) |
| `purchase_date` | date | | |
| `notes` | text | | |
| `created_by` | uuid | | → `auth.users(id)` |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `purchaseLogsService` (services.ts:2010). Capability: `purchase_log` (Growth+, VISION §5.5, §10.2).

---

#### `stock_items`

Current supply levels (manual entry, not auto-calculated) with low-stock thresholds.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)`. Tenant isolation per §18.2 |
| `name` | text NOT NULL | | Supply item name |
| `category` | text | | Optional grouping |
| `quantity` | numeric | `0` | CHECK: >= 0. Current level |
| `unit` | text | | e.g. kg, L |
| `low_threshold` | numeric | | Triggers low_stock alert when quantity < this |
| `notes` | text | | |
| `last_adjusted_at` | timestamptz | | Updated on manual adjustment |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `stockItemsService` (services.ts:2113). Capability: `stock_overview` (Growth+, VISION §5.5, §10.2).

---

#### `stock_adjustments`

Manual stock adjustment history (owner updates after physical count).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)`. Tenant isolation per §18.2 |
| `stock_item_id` | uuid FK NOT NULL | | → `stock_items(id)` |
| `previous_qty` | numeric NOT NULL | | Level before adjustment |
| `new_qty` | numeric NOT NULL | | Level after adjustment |
| `reason` | text | | Adjustment reason |
| `adjusted_by` | uuid | | → `auth.users(id)` |
| `adjusted_at` | timestamptz | `now()` | |

**Service:** `stockItemsService` (includes `adjustStock` method). Capability: `stock_overview` (Growth+, VISION §5.5, §10.2).

---

## 8. Database Configuration

### 8.1 Timezone

```sql
-- Timezone: Asia/Yangon (locked at database level)
-- VISION.md v3.1.0 §18.2
ALTER DATABASE ejvvwnupiqytximrbmfw SET timezone = 'Asia/Yangon';

-- Verify
SHOW timezone;  -- Should return 'Asia/Yangon'
```

**Impact:** `CURRENT_DATE`, `now()`, and all `timestamptz` operations use Asia/Yangon. The daily order limit check in `checkout_complete` uses `CURRENT_DATE` which resolves to Asia/Yangon midnight. (VISION.md v3.1.0 §18.2)

### 8.2 Search Path Security

All user-defined functions use `SET search_path = ''` to prevent search path injection attacks. This is enforced in the function definition, not at the database level.

---

## 9. VISION.md v3.1.0 Consistency Checklist

| VISION.md Decision | database.md Location |
|--------------------|---------------------|
| Business type = `coffee_shop` only | `shops.business_type` CHECK |
| 3-tier: free/growth/pro | `shops.subscription_tier` CHECK |
| Free: 50 orders/day | `shops.daily_order_limit` + `checkout_complete()` RPC |
| Free: 50 products max | Client + server validation (no DB constraint) |
| 4 roles | `users.role` CHECK + `shop_memberships.role` |
| Feature flags (capability-based) | `feature_definitions` (tier-based only) |
| Recipe/BOM **OUT OF SCOPE** | `recipes` + `recipe_lines` deprecated (§10.3, §19) |
| COGS / consumption log **OUT OF SCOPE** | `consumption_log` deprecated (§10.3, §19) |
| Multi-currency **DEAD** | `currency_config` + `exchange_rates` + `exchange_rate_history` deprecated (§19) |
| KDS **OUT OF SCOPE** | `kitchen_orders` deprecated — use thermal printer (§8, §19) |
| Printer integration (Growth+) | `print_jobs` (§8) |
| Receipt management | `shops.receipt_setting` + `print_jobs.is_reprint` (§9) |
| Cash drawer (Growth+) | `cash_shifts` (§12) |
| Checkout atomicity | `checkout_complete()` RPC (§11) |
| Race condition protection | `SELECT ... FOR UPDATE` in `checkout_complete` (§16.2) |
| Timezone: Asia/Yangon | `ALTER DATABASE SET timezone` (§18.2) |
| platform_admin (Edge Function only) | `users.role` CHECK, not in RLS policies (§4.3, §17) |
| MMK only — no multi-currency | No active currency conversion tables (§19) |
| Simplified inventory (Growth+) | Purchase log, stock overview, low stock alerts (§10) |
| Simple profit report (Pro) | Revenue − Purchases (§10.2, §13) |

## 10. CI Validation

### 10.1 Schema Drift Check

A CI workflow (`.github/workflows/schema-check.yml`) runs on every push/PR to detect inconsistencies between `docs/specs/tier-spec.md`, `docs/architecture/database.md`, and `src/lib/database.types.ts`.

**Two modes:**

| Mode | When | DB connection | Secrets needed? |
|------|------|---------------|-----------------|
| **Doc-only** | CI (push/PR) | No | None |
| **Live-DB** | Local (`npx tsx scripts/check-schema-drift.ts`) | Yes | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or service_role key) |

- **CI (doc-only):** Runs documentation-consistency checks only — compares tier-spec.md ↔ database.md ↔ database.types.ts (TypeScript type coverage, P1). DB-dependent checks are SKIPPED in doc-only mode (`missing_tables` P0, `undocumented_tables` P2, `column_count_drift` P2, `default_enabled_mismatch` P1, `dead_keys_in_db` P2) — these require a live Supabase connection and run in local mode only. No secrets required.
- **Local (live-DB):** Adds live queries against `feature_definitions` to verify `default_enabled` mismatches and dead-key cleanup. Pair with `@db-guardian` before running on production. Blocking on P0 drift, warning on P1/P2.

**Exit codes:** `0` = clean or P1/P2 drift (advisory), `1` = P0 drift (blocking).

**Report artifact:** `schema-drift-report.json` is uploaded on every CI run (even on failure) for debugging.
