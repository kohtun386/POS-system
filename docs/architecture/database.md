# Database Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last schema migration:** `20260620000001_shop_id_placeholder.sql`
**Generated:** 2026-06-20
**Reconciled:** 2026-06-29 (aligned with VISION.md v3.0.0)

> **Multi-tenancy:** The `shop_id` foundation exists with a single default shop and no shop-switching UI yet. Dynamic shop configuration is the next milestone: `shops` owns business identity and POS behavior, while `app_settings` is trimmed to global/preferences-style settings. See `docs/specs/multi-tenancy.md` and `docs/specs/dynamic-shop-configuration.md`.

---

## 1. Tables

### 1.1 Core Business Tables

#### `app_settings`
Global/preferences-style configuration. This table no longer owns store identity, tax, currency, or invoice numbering in the target dynamic shop configuration architecture.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK | default shop | Compatibility tenant link and cleanup key |
| `interface_mode` | text | `'touch'` | CHECK: `'touch'` \| `'traditional'` |
| `auto_backup` | boolean | `true` | Backup preference |
| `receipt_printer` | boolean | `false` | Printer preference |
| `theme` | text | `'light'` | CHECK: `'light'` \| `'dark'` \| `'auto'` |
| `exchange_rate_provider` | text | `'exchangerate'` | Global rate provider |
| `exchange_rate_api_key` | text | | Temporarily stored in DB; security risk documented below |
| `exchange_rate_update_interval` | integer | `60` | Minutes |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Canonical ownership:** Store name, address, phone, email, logo, tax rate, display currency, base currency, invoice prefix, invoice counter, business type, and draft retention belong to `shops`.

**Exchange-rate API key note:** `exchange_rate_api_key` remains in `app_settings` for the current architecture. This is a known security compromise. Future work should move provider keys to Edge Function secrets or server-side deployment environment variables and document rotation.

**Service:** `settingsService.get()` and `settingsService.update()` should handle only the global/preference fields above. Shop-owned fields must use `shopsService`.

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
| `product_type` | text | `'finished'` | CHECK: `'finished'` \| `'raw_material'`. Distinguishes menu items from ingredients (Recipe/BOM support, VISION.md v3.0.0 Section 10). |
| `base_currency` | text | `'USD'` | Added in currency migration |
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
| `role` | text NOT NULL | `'cashier'` | CHECK: `'platform_admin'` \| `'admin'` \| `'manager'` \| `'cashier'`. 4 roles (VISION.md v3.0.0 Section 4). |
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

All three remain inactive until `platform_admin` approves via Edge Function. (VISION.md v3.0.0 Section 6)

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
| `cashier_role` | text | | |
| `receipt_number` | text | | |
| `receipt_printed` | boolean | `false` | Whether receipt was printed for this sale (VISION.md v3.0.0 Section 9). |
| `notes` | text | | |
| `applied_discounts` | jsonb | `'[]'` | Array of AppliedDiscount objects |
| `free_gifts` | jsonb | `'[]'` | Array of CartItem objects |
| `transaction_currency` | text | `'USD'` | |
| `base_currency_amount` | decimal(12,2) | | |
| `exchange_rate_used` | decimal(15,8) | | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Triggers:**
- `trigger_auto_generate_invoice_number` — BEFORE INSERT, fills empty invoice_number
- `trigger_update_customer_stats` — AFTER INSERT/UPDATE, updates `customers.total_purchases` and `last_purchase`

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

### 1.2 Currency Tables

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

#### `exchange_rates`
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
  ├── recipes.product_id (finished product)
  ├── recipe_items.ingredient_id (raw material)
  ├── consumption_log.product_id (finished product)
  ├── consumption_log.ingredient_id (raw material)
  └── discounts.free_gift_products (TEXT[] — no FK, soft reference)

customers
  ├── sales.customer_id (SET NULL)
  └── sales_tabs.selected_customer_id (SET NULL)

users
  ├── sales_tabs.user_id (CASCADE)
  ├── sales.cashier_id
  └── cash_shifts.cashier_id

shops
  ├── shop_memberships.shop_id (CASCADE)
  ├── shop_features.shop_id (CASCADE)
  ├── recipes.shop_id
  ├── consumption_log.shop_id
  ├── print_jobs.shop_id
  ├── cash_shifts.shop_id
  ├── alert_recipients.shop_id
  ├── alert_templates.shop_id
  ├── alert_configurations.shop_id
  ├── alert_history.shop_id
  ├── notification_service_config.shop_id
  └── (all 13 original tables via shop_id)

recipes
  └── recipe_items.recipe_id (CASCADE)

sales
  ├── consumption_log.sale_id
  └── print_jobs.sale_id

feature_definitions
  └── shop_features.feature_key (CASCADE)
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
| `idx_products_base_currency` | `base_currency` | B-tree | |

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
| `idx_sales_transaction_currency` | `transaction_currency` | B-tree | |
| `idx_sales_created_at_currency` | `created_at, transaction_currency` | Composite | |

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

### Currency Tables
| Index | Column(s) | Table | Notes |
|-------|-----------|-------|-------|
| `idx_exchange_rates_base_target` | `base_currency, target_currency` | exchange_rates | |
| `idx_exchange_rates_effective_from` | `effective_from` | exchange_rates | |
| `idx_exchange_rates_active` | `base_currency, target_currency, effective_from` | exchange_rates | Partial: `WHERE effective_to IS NULL` |
| `idx_currency_config_code` | `code` | currency_config | |
| `idx_currency_config_active` | `is_active` | currency_config | |
| `idx_currency_config_base` | `is_base_currency` | currency_config | Partial: `WHERE is_base_currency = true` |
| `idx_exchange_rate_history_currencies` | `base_currency, target_currency` | exchange_rate_history | |
| `idx_exchange_rate_history_recorded_at` | `recorded_at` | exchange_rate_history | |

### Missing Indexes (Identified)

| Table | Column | Why Needed |
|-------|--------|------------|
| `sales` | `payments` | GIN for JSONB search by payment method in split payments |
| `app_settings` | (none) | Single-row table, not needed |

---

## 4. Functions

| Function | Security | Purpose | Trigger? |
|----------|----------|---------|----------|
| `update_updated_at_column()` | INVOKER, `search_path=''` | Sets `updated_at = now()` on UPDATE | Yes — all tables with `updated_at` |
| `generate_invoice_number(p_shop_id uuid)` | INVOKER, `search_path=''` | Atomically reads `shops.invoice_prefix`/`invoice_counter`, increments the shop counter, returns formatted invoice number | No — called by `auto_generate_invoice_number()` or RPC-backed service path |
| `auto_generate_invoice_number()` | INVOKER, `search_path=''` | Calls `generate_invoice_number(NEW.shop_id)` if invoice_number is empty | Yes — BEFORE INSERT on `sales` |
| `update_customer_stats()` | INVOKER, `search_path=''` | Updates `customers.total_purchases` and `last_purchase` | Yes — AFTER INSERT/UPDATE on `sales` |
| `handle_new_auth_user()` | SECURITY DEFINER, `search_path=''` | Creates `public.users` row on `auth.users` insert | Yes — AFTER INSERT on `auth.users` |
| `get_current_exchange_rate(text, text)` | INVOKER, `search_path=''` | Returns current rate between two currencies | No — called from app |
| `convert_currency_amount(decimal, text, text)` | INVOKER, `search_path=''` | Converts amount using current rate | No — called from app |
| `update_exchange_rate(text, text, decimal, text, boolean)` | INVOKER, `search_path=''` | Ends current rate, inserts new, records history | No — called from app |
| `rls_auto_enable()` | SECURITY DEFINER | Auto-enables RLS. Revoked from client roles | Event trigger |
| `checkout_complete(uuid, jsonb, jsonb, uuid)` | INVOKER, `search_path=''` | Atomic all-or-nothing checkout transaction. Race condition protection via `SELECT ... FOR UPDATE` on shops row. Checks `daily_order_limit`, generates invoice, inserts sale, deducts inventory (recipe-based), creates print jobs, updates customer stats, logs consumption. RAISES `DAILY_LIMIT_REACHED` if limit exceeded. | No — called via `supabase.rpc()` |
| `current_shop_ids()` | INVOKER, `search_path=''` | Returns `uuid[]` of shop IDs where current user has active membership. Used in RLS policies for shop-scoped access. | No — called in RLS policies |

---

## 5. RLS Policy Summary

**Pattern:** All tables have RLS enabled. Policies use shop-scoped role-aware pattern.

**`platform_admin` rule:** NEVER appears in RLS policies. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions. No `OR users.role = 'platform_admin'` in any policy. (VISION.md v3.0.0 Section 4.3)

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
| `currency_config` | Shop members | admin/manager | admin/manager | admin/manager |
| `exchange_rates` | Shop members | admin/manager | admin/manager | admin/manager |
| `exchange_rate_history` | Shop members | admin/manager | admin/manager | admin/manager |
| `feature_definitions` | All authenticated | (Edge Function only) | (Edge Function only) | (Edge Function only) |
| `shop_features` | Shop members | admin only | admin only | admin only |
| `recipes` | Shop members | admin/manager | admin/manager | admin/manager |
| `recipe_items` | Shop members | admin/manager | admin/manager | admin/manager |
| `consumption_log` | Shop members | (RPC only) | (none) | (none) |
| `print_jobs` | Shop members | (RPC/Edge Function) | (Edge Function) | (none) |
| `cash_shifts` | Shop members | cashier+ (own) | cashier+ (own) | admin/manager |

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
- `consumption_log`: INSERT only via `checkout_complete` RPC (no direct client insert)
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
| `currency` | text | `'USD'` | Per-shop display currency |
| `base_currency` | text | `'USD'` | Per-shop base currency for pricing |
| `invoice_prefix` | text | `'INV'` | Invoice prefix |
| `invoice_counter` | integer | `1000` | Mutated only by atomic invoice DB function |
| `draft_retention_days` | integer | `30` | Cleanup retention for draft sales |
| `subscription_tier` | text | `'free'` | CHECK: `'free'` \| `'growth'` \| `'pro'`. 3-tier model (VISION.md v3.0.0 Section 3). |
| `daily_order_limit` | integer | `50` | Free tier: 50. Growth/Pro: NULL (unlimited). Enforced in `checkout_complete` RPC. |
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
| `idx_currency_config_shop_id` | currency_config | B-tree |
| `idx_exchange_rates_shop_id` | exchange_rates | B-tree |
| `idx_exchange_rate_history_shop_id` | exchange_rate_history | B-tree |
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

> Added 2026-06-29. Aligned with VISION.md v3.0.0 Sections 5, 8, 9, 10, 12.

### 7.1 `feature_definitions`

Platform-level feature catalog. Managed exclusively by `platform_admin` via Edge Functions.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `key` | text NOT NULL | | UNIQUE. e.g. `'printer_integration'`, `'recipe_bom'` |
| `name` | text NOT NULL | | Human-readable name |
| `description` | text | | |
| `category` | text NOT NULL | `'general'` | |
| `default_enabled` | boolean NOT NULL | `true` | |
| `min_tier` | text NOT NULL | `'free'` | CHECK: `'free'` \| `'growth'` \| `'pro'` |
| `applicable_types` | text[] | `'{coffee_shop}'` | Business types this feature applies to |
| `created_at` | timestamptz NOT NULL | `now()` | |

---

### 7.2 `shop_features`

Per-shop feature overrides. Only stores deviations from defaults.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` ON DELETE CASCADE |
| `feature_key` | text NOT NULL | | → `feature_definitions(key)` ON DELETE CASCADE |
| `enabled` | boolean NOT NULL | `true` | |
| `updated_at` | timestamptz NOT NULL | `now()` | |

**Constraint:** UNIQUE(`shop_id`, `feature_key`)

---

### 7.3 `recipes`

Bill of Materials (BOM) header. Links a finished product to its recipe. Growth+ only (VISION.md v3.0.0 Section 10).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `product_id` | uuid FK NOT NULL | | → `products(id)` — the finished product |
| `name` | text NOT NULL | | Recipe name |
| `notes` | text | | |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Constraint:** UNIQUE(`shop_id`, `product_id`)

---

### 7.4 `recipe_items`

Recipe line items. Each row is one ingredient in a recipe.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `recipe_id` | uuid FK NOT NULL | | → `recipes(id)` ON DELETE CASCADE |
| `ingredient_id` | uuid FK NOT NULL | | → `products(id)` — raw material product |
| `quantity` | numeric(10,3) NOT NULL | | e.g. 18.000 grams |
| `unit` | text NOT NULL | | CHECK: `'g'` \| `'ml'` \| `'pcs'` \| `'kg'` \| `'l'` |
| `cost_per_unit` | numeric(10,2) NOT NULL | | Cost per 1 unit of ingredient |
| `total_cost` | numeric(10,2) | | GENERATED ALWAYS AS (`quantity * cost_per_unit`) STORED |
| `created_at` | timestamptz | `now()` | NOT NULL |

---

### 7.5 `consumption_log`

Logs actual ingredient consumption per sale. Used for COGS calculation. Inserted by `checkout_complete` RPC.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `sale_id` | uuid FK NOT NULL | | → `sales(id)` |
| `product_id` | uuid FK NOT NULL | | → `products(id)` — finished product sold |
| `ingredient_id` | uuid FK NOT NULL | | → `products(id)` — raw material consumed |
| `quantity` | numeric(10,3) NOT NULL | | Actual quantity consumed |
| `unit` | text NOT NULL | | |
| `cost` | numeric(10,2) NOT NULL | | Cost of consumed quantity |
| `created_at` | timestamptz | `now()` | NOT NULL |

---

### 7.6 `print_jobs`

Print job queue for receipt and kitchen printers. Growth+ only (VISION.md v3.0.0 Section 8).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `shop_id` | uuid FK NOT NULL | | → `shops(id)` |
| `sale_id` | uuid FK NOT NULL | | → `sales(id)` |
| `printer_type` | text NOT NULL | | CHECK: `'receipt'` \| `'kitchen'` |
| `status` | text NOT NULL | `'pending'` | CHECK: `'pending'` \| `'printing'` \| `'completed'` \| `'failed'` |
| `connection_type` | text NOT NULL | | CHECK: `'bluetooth'` \| `'network'` |
| `printer_address` | text NOT NULL | | BT MAC address or IP:port |
| `payload` | jsonb NOT NULL | | Formatted print content |
| `is_reprint` | boolean | `false` | True if reprinted from history (VISION.md v3.0.0 Section 9.3) |
| `retry_count` | integer | `0` | |
| `error_message` | text | | |
| `created_at` | timestamptz NOT NULL | `now()` | |
| `completed_at` | timestamptz | | |

---

### 7.7 `cash_shifts`

Cash drawer shift tracking. Growth+ only (VISION.md v3.0.0 Section 12).

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
| `idx_shop_features_shop_key` | shop_features | `shop_id, feature_key` | B-tree (UNIQUE) | |
| `idx_recipes_shop_product` | recipes | `shop_id, product_id` | B-tree (UNIQUE) | |
| `idx_recipe_items_recipe` | recipe_items | `recipe_id` | B-tree | |
| `idx_recipe_items_ingredient` | recipe_items | `ingredient_id` | B-tree | |
| `idx_consumption_log_sale` | consumption_log | `sale_id` | B-tree | |
| `idx_consumption_log_daily` | consumption_log | `shop_id, created_at` | B-tree | Daily COGS queries |
| `idx_print_jobs_pending` | print_jobs | `status` | Partial | `WHERE status = 'pending'` — pg_cron polling |
| `idx_print_jobs_shop` | print_jobs | `shop_id` | B-tree | |
| `idx_cash_shifts_shop_open` | cash_shifts | `shop_id, status` | Partial | `WHERE status = 'open'` |
| `idx_cash_shifts_cashier` | cash_shifts | `cashier_id` | B-tree | |
| `idx_sales_cashier_id` | sales | `cashier_id` | B-tree | Shift tracking |
| `idx_sales_shop_created_status` | sales | `shop_id, created_at, status` | Composite | Daily limit check in `checkout_complete` |

---

## 8. Database Configuration

### 8.1 Timezone

```sql
-- Timezone: Asia/Yangon (locked at database level)
-- VISION.md v3.0.0 Decision #14
ALTER DATABASE ejvvwnupiqytximrbmfw SET timezone = 'Asia/Yangon';

-- Verify
SHOW timezone;  -- Should return 'Asia/Yangon'
```

**Impact:** `CURRENT_DATE`, `now()`, and all `timestamptz` operations use Asia/Yangon. The daily order limit check in `checkout_complete` uses `CURRENT_DATE` which resolves to Asia/Yangon midnight.

### 8.2 Search Path Security

All user-defined functions use `SET search_path = ''` to prevent search path injection attacks. This is enforced in the function definition, not at the database level.

---

## 9. VISION.md v3.0.0 Consistency Checklist

| VISION.md Decision | database.md Location |
|--------------------|---------------------|
| Business type = `coffee_shop` only | `shops.business_type` CHECK |
| 3-tier: free/growth/pro | `shops.subscription_tier` CHECK |
| Free: 50 orders/day | `shops.daily_order_limit` + `checkout_complete()` RPC |
| Free: 50 products max | Client + server validation (no DB constraint) |
| 4 roles | `users.role` CHECK + `shop_memberships.role` |
| Feature flags (capability-based) | `feature_definitions` + `shop_features` |
| Recipe/BOM (Growth+) | `recipes` + `recipe_items` + `consumption_log` |
| Printer integration (Growth+) | `print_jobs` |
| Receipt management | `shops.receipt_setting` + `print_jobs.is_reprint` |
| Cash drawer (Growth+) | `cash_shifts` |
| Checkout atomicity | `checkout_complete()` RPC |
| Race condition protection | `SELECT ... FOR UPDATE` in `checkout_complete` |
| Timezone: Asia/Yangon | `ALTER DATABASE SET timezone` |
| platform_admin (Edge Function only) | `users.role` CHECK, not in RLS policies |
