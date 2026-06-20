# Database Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last schema migration:** `20260619000003_fix_user_creation_flow.sql`
**Generated:** 2026-06-19

---

## 1. Tables

### 1.1 Core Business Tables

#### `app_settings`
Single-row store configuration. One row per POS installation.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid PK | `gen_random_uuid()` | |
| `store_name` | text | `'sekaLabs 2025 POS'` | |
| `store_address` | text | | |
| `store_phone` | text | | |
| `store_email` | text | | |
| `store_logo` | text | | Base64 or URL |
| `tax_rate` | decimal(5,4) | `0.0000` | 0.0875 = 8.75% |
| `currency` | text | `'USD'` | Display currency |
| `base_currency` | text | `'USD'` | Base currency for pricing |
| `interface_mode` | text | `'touch'` | CHECK: `'touch'` \| `'traditional'` |
| `auto_backup` | boolean | `true` | |
| `receipt_printer` | boolean | `false` | |
| `theme` | text | `'light'` | CHECK: `'light'` \| `'dark'` \| `'auto'` |
| `invoice_prefix` | text | `'INV'` | |
| `invoice_counter` | integer | `1000` | Monotonic counter |
| `exchange_rate_provider` | text | `'exchangerate'` | |
| `exchange_rate_api_key` | text | | |
| `exchange_rate_update_interval` | integer | `60` | Minutes |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Service:** `settingsService.get()` → `SELECT * ... LIMIT 1`. `settingsService.update()` fetches ID first, then UPDATEs by ID.

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
| `role` | text NOT NULL | `'cashier'` | CHECK: `'admin'` \| `'manager'` \| `'cashier'` |
| `permissions` | text[] | `'{}'` | Currently unused (role governs access) |
| `active` | boolean | `true` | |
| `last_login` | timestamptz | | |
| `avatar` | text | | URL |
| `created_at` | timestamptz | `now()` | NOT NULL |
| `updated_at` | timestamptz | `now()` | NOT NULL, auto-update trigger |

**Auto-creation:** `handle_new_auth_user()` trigger on `auth.users` INSERT → creates profile with role `'cashier'`, permissions `['pos_access']`. Frontend then UPDATES this row with admin-chosen role.

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
| `cashier_role` | text | | |
| `receipt_number` | text | | |
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
  └── discounts.free_gift_products (TEXT[] — no FK, soft reference)

customers
  ├── sales.customer_id (SET NULL)
  └── sales_tabs.selected_customer_id (SET NULL)

users
  └── sales_tabs.user_id (CASCADE)
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
| `generate_invoice_number()` | INVOKER, `search_path=''` | Reads `app_settings`, increments counter, returns formatted number | No — called by `auto_generate_invoice_number()` |
| `auto_generate_invoice_number()` | INVOKER, `search_path=''` | Calls `generate_invoice_number()` if invoice_number is empty | Yes — BEFORE INSERT on `sales` |
| `update_customer_stats()` | INVOKER, `search_path=''` | Updates `customers.total_purchases` and `last_purchase` | Yes — AFTER INSERT/UPDATE on `sales` |
| `handle_new_auth_user()` | SECURITY DEFINER, `search_path=''` | Creates `public.users` row on `auth.users` insert | Yes — AFTER INSERT on `auth.users` |
| `get_current_exchange_rate(text, text)` | INVOKER, `search_path=''` | Returns current rate between two currencies | No — called from app |
| `convert_currency_amount(decimal, text, text)` | INVOKER, `search_path=''` | Converts amount using current rate | No — called from app |
| `update_exchange_rate(text, text, decimal, text, boolean)` | INVOKER, `search_path=''` | Ends current rate, inserts new, records history | No — called from app |
| `rls_auto_enable()` | SECURITY DEFINER | Auto-enables RLS. Revoked from client roles | Event trigger |

---

## 5. RLS Policy Summary

**Pattern:** All tables have RLS enabled. Policies use role-aware pattern.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `app_settings` | All authenticated | admin/manager | admin/manager | admin/manager |
| `categories` | All authenticated | admin/manager | admin/manager | admin/manager |
| `customers` | All authenticated | admin/manager | admin/manager | admin/manager |
| `suppliers` | All authenticated | admin/manager | admin/manager | admin/manager |
| `products` | All authenticated | admin/manager | admin/manager | admin/manager |
| `product_batches` | All authenticated | admin/manager | admin/manager | admin/manager |
| `discounts` | All authenticated | admin/manager | admin/manager | admin/manager |
| `users` | All authenticated | All authenticated | Self OR admin | (none — no DELETE policy) |
| `sales` | All authenticated | All authenticated | admin/manager | admin/manager |
| `sales_tabs` | Own tabs only | Own tabs only | Own tabs only | Own tabs only |
| `currency_config` | All authenticated | admin/manager | admin/manager | admin/manager |
| `exchange_rates` | All authenticated | admin/manager | admin/manager | admin/manager |
| `exchange_rate_history` | All authenticated | admin/manager | admin/manager | admin/manager |

**Notable:**
- `users` UPDATE: `(auth.uid() = id) OR EXISTS (admin user)` — self-edit or admin
- `users` INSERT: `auth.role() = 'authenticated'` — trigger handles profile creation
- `users` DELETE: No policy defined (implicit deny — no one can delete users via RLS)
- `sales_tabs`: Only `user_id = auth.uid()` — complete user isolation
- `sales`: Cashiers can INSERT (record transactions) but not UPDATE/DELETE
- All admin/manager checks use `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))`
