# Dynamic Shop Configuration System — Design Spec

**Date:** 2026-06-22
**Status:** Active — reconciled 2026-06-29 (aligned with VISION.md v3.0.0)
**Scope:** Multi-tenant SaaS transition — global settings → per-shop configuration
**Source of truth:** `docs/vision/VISION.md` v3.0.0

---

## Executive Summary

The CoffeeShop POS currently stores all configuration — business identity, POS behavior, and user preferences — in a single global `app_settings` row. This breaks multi-tenancy: shops share currency, tax rates, invoice counters, and store branding.

This spec defines the full transition to per-shop configuration using general SaaS patterns (organization model, membership roles, tenant-scoped RLS, subscription tiers) without adopting a specific boilerplate. The work is split into 4 phases: database migration, service layer, state/UI refactor, and governance features (approval workflow, anti-bot, auto-cleanup).

**Key decisions:**
- Exchange-rate configuration stays in `app_settings` as global/preferences-style configuration. API keys remain there temporarily with explicit security risk and future server-side secret migration.
- Draft retention is shop-configurable, defaulting to 30 days
- New signups enter `PENDING` state — require email verification when enabled plus approval before POS access
- RLS corrected so shop admins (not just global admins) manage shop settings
- Cart persistence uses localStorage as primary, `sales_tabs.cart` as backup — cleanup cron is safe

---

## 1. Data Model Architecture

### 1.1 Three-Layer Configuration Model

| Layer | Storage | Contents | Rationale |
|-------|---------|----------|-----------|
| **Platform Config** | `.env` / deployment config | Supabase URL, anon key, service role key, API secrets | Secrets never in DB. Deploy-time config. |
| **Global Preferences** | `app_settings` | Theme, interface mode, auto backup, receipt printer, exchange-rate config | Preferences/global operational settings, not business identity. Exchange-rate API keys remain here temporarily with documented risk. |
| **Shop Config** | `shops` table (per-shop rows) | Name, address, phone, email, logo, tax rate, currency, base currency, invoice prefix/counter, business type, subscription tier | Business identity + POS behavior. Core multi-tenant data. |

### 1.2 `shops` Table — Current vs Target

**Current columns** (from migration `20260620000001`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | NOT NULL |
| `address` | text | |
| `phone` | text | |
| `email` | text | |
| `owner_id` | uuid | |
| `subscription_tier` | text | DEFAULT 'free', CHECK (free/growth/pro) |
| `is_active` | boolean | DEFAULT true |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Columns to add** (8):

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `logo` | text | NULL | Store logo (base64 or URL) |
| `business_type` | text | `'coffee_shop'` | Business category. CHECK: coffee_shop (v1), restaurant/food_court (v2). Permanently excluded: pharmacy, retail, supermarket, other. (VISION §2) |
| `tax_rate` | numeric(5,4) | `0.0000` | Per-shop tax rate |
| `currency` | text | `'USD'` | Display currency |
| `base_currency` | text | `'USD'` | Base currency for pricing |
| `invoice_prefix` | text | `'INV'` | Invoice number prefix |
| `invoice_counter` | integer | `1000` | Next invoice number; mutated only by atomic DB function |
| `draft_retention_days` | integer | `30` | Shop-configurable draft cleanup retention |

### 1.3 `app_settings` Table — Trimmed to Preferences

**Columns to drop** (10): `store_name`, `store_address`, `store_phone`, `store_email`, `store_logo`, `tax_rate`, `currency`, `base_currency`, `invoice_prefix`, `invoice_counter`.

**Columns retained:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `shop_id` | uuid | FK to shops (NOT NULL, DEFAULT to default shop) |
| `interface_mode` | text | touch/traditional |
| `auto_backup` | boolean | Backup toggle |
| `receipt_printer` | boolean | Printer toggle |
| `theme` | text | light/dark/auto |
| `exchange_rate_provider` | text | Rate provider (stays global) |
| `exchange_rate_api_key` | text | API key, temporarily DB-stored global setting; known security risk |
| `exchange_rate_update_interval` | integer | Update interval in minutes |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 1.4 TypeScript Interfaces

```typescript
// src/types/index.ts

export interface Shop {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  ownerId?: string;
  businessType: 'coffee_shop' | 'restaurant' | 'food_court';
  subscriptionTier: 'free' | 'growth' | 'pro';
  isActive: boolean;
  dailyOrderLimit: number;
  // POS config (moved from app_settings)
  taxRate: number;
  currency: string;
  baseCurrency: string;
  invoicePrefix: string;
  invoiceCounter: number;
  // Data retention (new — shop-configurable)
  draftRetentionDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  // Preferences only (trimmed from 17 fields → 7)
  interfaceMode: 'touch' | 'traditional';
  autoBackup: boolean;
  receiptPrinter: boolean;
  theme: 'light' | 'dark' | 'auto';
  exchangeRateProvider?: 'fixer' | 'currencylayer' | 'exchangerate' | 'manual';
  exchangeRateApiKey?: string;
  exchangeRateUpdateInterval?: number;
}
```

### 1.5 Fallback Logic

Shop fields use hardcoded defaults when NULL — no fallback chain to `app_settings`:

```
shop.name ?? 'CoffeeShop POS'
shop.address ?? ''
shop.phone ?? ''
shop.email ?? ''
shop.currency ?? 'MMK'
shop.baseCurrency ?? 'MMK'
shop.taxRate ?? 0
shop.invoicePrefix ?? 'INV'
shop.invoiceCounter ?? 1000
shop.businessType ?? 'coffee_shop'
shop.subscriptionTier ?? 'free'
shop.dailyOrderLimit ?? 50
shop.draftRetentionDays ?? 30
```

---

## 2. State Management & Services

### 2.1 AppState Changes

```typescript
// src/context/SupabaseAppContext.tsx

interface AppState {
  // NEW — business identity + POS config
  shop: Shop;
  // TRIMMED — preferences only
  settings: AppSettings;
  activeShopId: string;
  // ... rest unchanged (products, customers, sales, users, discounts, cart, etc.)
}
```

### 2.2 New Actions

```typescript
type AppAction =
  | { type: 'SET_SHOP'; payload: Partial<Shop> }
  // ... existing actions
```

Invoice counter mutation is intentionally not a normal frontend reducer action. Checkout invoice generation must use the atomic database function/RPC path. If an administrative invoice reset feature is later added, it should be modeled as an explicit admin workflow, not reused by checkout.

### 2.3 Reducer

```typescript
case 'SET_SHOP':
  return { ...state, shop: { ...state.shop, ...action.payload } };
```

There is no checkout-facing `INCREMENT_INVOICE_COUNTER` reducer in the target architecture. The database-owned invoice function mutates `shops.invoice_counter` atomically.

### 2.4 Initial State

```typescript
const initialState = {
  shop: {
    id: '',
    name: 'CoffeeShop POS',
    address: '',
    phone: '',
    email: '',
    businessType: 'coffee_shop',
    taxRate: 0,
    currency: 'MMK',
    baseCurrency: 'MMK',
    invoicePrefix: 'INV',
    invoiceCounter: 1000,
    subscriptionTier: 'free',
    dailyOrderLimit: 50,
    isActive: true,
    draftRetentionDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  settings: {
    interfaceMode: 'touch',
    autoBackup: true,
    receiptPrinter: true,
    theme: 'light',
    exchangeRateProvider: 'exchangerate',
    exchangeRateApiKey: '',
    exchangeRateUpdateInterval: 60,
  },
};
```

### 2.5 `shopsService` — New

```typescript
// src/lib/services.ts

export const shopsService = {
  async getByUserId(userId: string): Promise<Shop> {
    // 1. Get user's active shop_id from shop_memberships
    const { data: membership, error: memError } = await supabase
      .from('shop_memberships')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (memError || !membership) throw new Error('No active shop membership');

    // 2. Load shop
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', membership.shop_id)
      .single();

    if (error) throw error;
    return mapShopRow(data);
  },

  async update(id: string, shop: Partial<Shop>): Promise<Shop> {
    const updateData: Record<string, any> = {};
    if (shop.name !== undefined) updateData.name = shop.name;
    if (shop.address !== undefined) updateData.address = shop.address;
    if (shop.phone !== undefined) updateData.phone = shop.phone;
    if (shop.email !== undefined) updateData.email = shop.email;
    if (shop.logo !== undefined) updateData.logo = shop.logo;
    if (shop.businessType !== undefined) updateData.business_type = shop.businessType;
    if (shop.taxRate !== undefined) updateData.tax_rate = shop.taxRate;
    if (shop.currency !== undefined) updateData.currency = shop.currency;
    if (shop.baseCurrency !== undefined) updateData.base_currency = shop.baseCurrency;
    if (shop.invoicePrefix !== undefined) updateData.invoice_prefix = shop.invoicePrefix;
    // Do not update invoice_counter in normal checkout flows. Use the atomic DB invoice function instead.
    if (shop.invoiceCounter !== undefined) updateData.invoice_counter = shop.invoiceCounter; // admin reset only
    if (shop.draftRetentionDays !== undefined) updateData.draft_retention_days = shop.draftRetentionDays;

    const { data, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapShopRow(data);
  }
};

function mapShopRow(data: any): Shop {
  return {
    id: data.id,
    name: data.name || 'CoffeeShop POS',
    address: data.address || '',
    phone: data.phone || '',
    email: data.email || '',
    logo: data.logo || undefined,
    ownerId: data.owner_id || undefined,
    businessType: data.business_type || 'coffee_shop',
    subscriptionTier: data.subscription_tier || 'free',
    isActive: data.is_active ?? true,
    dailyOrderLimit: data.daily_order_limit ?? 50,
    taxRate: data.tax_rate ?? 0,
    currency: data.currency || 'MMK',
    baseCurrency: data.base_currency || 'MMK',
    invoicePrefix: data.invoice_prefix || 'INV',
    invoiceCounter: data.invoice_counter ?? 1000,
    draftRetentionDays: data.draft_retention_days ?? 30,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
```

### 2.6 `settingsService` — Trimmed

`get()` and `update()` remove all store identity and POS config columns. Only handle: `interface_mode`, `auto_backup`, `receipt_printer`, `theme`, `exchange_rate_*`.

### 2.7 Data Loading

```typescript
async function loadData() {
  const [
    shop, settings, products, customers, sales,
    discounts, users, salesTabs
  ] = await Promise.all([
    user ? shopsService.getByUserId(user.id) : Promise.resolve(null),
    settingsService.get(),
    productsService.getAll(),
    customersService.getAll(),
    salesService.getAll().then(r => r.data),
    discountsService.getAll(),
    usersService.getAll(),
    user ? salesTabsService.getByUserId(user.id) : Promise.resolve([]),
  ]);

  if (shop) dispatch({ type: 'SET_SHOP', payload: shop });
  dispatch({ type: 'SET_SETTINGS', payload: settings });
  // ... rest unchanged
}
```

### 2.8 Invoice Generation — DB-Owned Atomic Source Of Truth

```typescript
// src/context/SupabaseAppContext.tsx

export function useInvoiceGeneration() {
  const { state } = useApp();

  return async () => {
    return await invoicesService.generateForShop(state.shop.id);
  };
}
```

`invoicesService.generateForShop(shopId)` must call the DB-owned atomic invoice generation path, such as RPC `generate_invoice_number(p_shop_id)`, or invoke `checkout_complete()` which handles invoice generation internally.

> **Note (2026-07-04):** The `auto_generate_invoice_number()` trigger was dropped in migration m38. Invoice generation now happens inside the `checkout_complete()` RPC. This spec section is historical.

Frontend code must not calculate and persist `invoiceCounter` increments as the source of truth. UI-only formatting helpers are allowed, but counter mutation must be atomic in the database to avoid duplicate invoice numbers under concurrent checkouts.

---

## 3. Database Function Refactoring

### 3.1 `generate_invoice_number()` — reads from `shops`

```sql
-- Drop old no-arg version
DROP FUNCTION IF EXISTS generate_invoice_number();

-- New: per-shop invoice generation
CREATE OR REPLACE FUNCTION generate_invoice_number(p_shop_id UUID)
RETURNS TEXT
SET search_path = ''
AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice_number TEXT;
BEGIN
    SELECT invoice_prefix, invoice_counter
    INTO prefix, counter
    FROM public.shops
    WHERE id = p_shop_id;

    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;

    new_invoice_number := prefix || '-' || LPAD(counter::TEXT, 6, '0');

    UPDATE public.shops
    SET invoice_counter = counter + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_shop_id;

    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;
```

### 3.2 ~~`auto_generate_invoice_number()` trigger~~ — DROPPED

> **Dropped in migration m38.** This trigger no longer exists. Invoice generation is now handled inside the `checkout_complete()` RPC, which calls `generate_invoice_number(NEW.shop_id)` directly.

The trigger code previously:
```sql
-- RETIRED: auto_generate_invoice_number() dropped in migration 20260703000007
-- Invoice generation now happens inside checkout_complete() RPC
```

**Dependency:** `sales.shop_id` already exists from multi-tenancy migration `20260620000001`.

---

## 4. Governance & Security

### 4.1 Account Approval Workflow

New signups enter a `PENDING` state. Access is gated until a platform admin approves.

**Flow:**

```
User signs up
  → auth.users row created
  → trigger handle_new_auth_user() fires
    → public.users row created (pending shop admin/owner, active=false)
    → shop_memberships row created (is_active=false)
    → shops row created (is_active=false) [NEW: for self-registration]
  → User sees "Pending Approval" screen
  → Authorized approver reviews → sets users.active=true, shop_memberships.is_active=true, shops.is_active=true
  → User can now access POS
```

**DB changes:**

```sql
-- handle_new_auth_user() update: new users get is_active=false
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    v_username TEXT;
    v_name TEXT;
    v_shop_id UUID;
    v_shop_name TEXT;
BEGIN
    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- 1. Create owner profile (inactive until approved)
    INSERT INTO public.users (id, username, name, email, role, permissions, active)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'admin',                          -- Pending shop owner = admin of their shop after approval
        ARRAY['pos_access']::TEXT[],
        false                             -- PENDING until approved
    );

    -- 2. Create shop for this user
    v_shop_id := gen_random_uuid();
    v_shop_name := COALESCE(
        NEW.raw_user_meta_data ->> 'shop_name',
        v_name || '''s Shop'
    );

    INSERT INTO public.shops (id, name, is_active)
    VALUES (v_shop_id, v_shop_name, false);  -- PENDING until approved

    -- 3. Create membership (inactive until approved)
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (NEW.id, v_shop_id, 'admin', false);  -- PENDING

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Frontend gating** (`AppContent.tsx`):

```typescript
// After auth, before loadData():
if (!state.shop.isActive) {
  return <PendingApprovalScreen />;
}
```

**Approval notification:**
- UI state change: user sees "Your account is pending approval" screen with no POS access
- Email notification: "Your shop has been approved! You can now access the POS."
- Platform admin sees pending shops in Platform Admin UI (`PendingShopsList.tsx`)
- Approval action: `supabase.functions.invoke('platform-admin-approve-shop', { shop_id })` — Edge Function activates user, membership, and shop using `service_role` key (VISION §17)

**Edge Functions for approval (VISION §17.3):**
| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activate shop + membership + user |
| `platform-admin-reject-shop` | Deny pending shop application |
| `platform-admin-update-subscription` | Change shop subscription_tier |

### 4.2 Anti-Bot Strategy

#### Mandatory Email Verification

Supabase Auth already supports email confirmation. Enable it:

```sql
-- In Supabase Dashboard → Auth → Settings
-- Require email confirmation before login
auth.enable_email_confirmations = true
```

This means:
- User signs up → receives confirmation email → clicks link → email verified
- Only then does `handle_new_auth_user()` trigger create the profile
- Unverified emails cannot log in

**Frontend:** Show "Please verify your email" message after signup. AuthContext already handles `Email not confirmed` error (line 29 of AuthContext.tsx).

#### Rate Limiting

Supabase has built-in rate limiting on auth endpoints. Additional layers:

| Layer | Mechanism | Config |
|-------|-----------|--------|
| **Supabase Auth** | Built-in brute-force protection | 30 attempts/hour per IP (default) |
| **Edge Function** | Custom rate limiter for signup endpoint | 5 signups per IP per hour |
| **RLS** | Policy-level: only authenticated users can read/write | Already enforced |
| **CAPTCHA** | Supabase supports Turnstile/HCaptcha on auth | Enable in Dashboard → Auth → Security |

**Recommended:** Enable Supabase's built-in CAPTCHA on signup (Dashboard → Auth → Security → Enable CAPTCHA).

### 4.3 RLS Correction — Shop Admin Policy (VISION §4.3, §17)

**Principle:** Platform admin operations bypass RLS entirely via Edge Functions using `service_role` key. RLS policies do NOT contain `OR users.role = 'platform_admin'`.

**Historical problem (older RLS draft):**

```sql
-- OLD: Shops write: GLOBAL admin only (users.role = 'admin')
-- This is too restrictive AND wrong — platform_admin should not be in RLS policies.
CREATE POLICY "Shops write by global admin" ON shops
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

**Target state:**

```sql
-- Shops SELECT: members can view their shops
CREATE POLICY "Shops viewable by own memberships" ON shops
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND id IN (
      SELECT shop_id FROM public.shop_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Shops UPDATE: shop admin can update their own shop
CREATE POLICY "Shops update by shop admin" ON shops
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND id IN (
      SELECT shop_id FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- Shops INSERT/DELETE: platform admin only, via Edge Function with service_role key.
-- No client-facing RLS policy for INSERT or DELETE.
-- Platform admin uses supabase.functions.invoke('platform-admin-approve-shop', ...) etc.
-- Edge Functions bypass RLS using service_role key. (VISION §17)
```

**Impact on Settings UI:**

```typescript
// canEditSettings guard split into two:
const canEditShopSettings = profile?.role === 'admin';  // Shop admin only
const canEditPreferences = profile?.role === 'admin' || profile?.role === 'manager';

// Platform admin operations are in a separate UI (src/components/platform/)
// and use supabase.functions.invoke() only — never supabase.from()
```

- Shop fields (name, address, currency, tax, invoice): admin only
- Preference fields (theme, interface mode, printer, backup): admin or manager

---

## 5. Cleanup Policy

### 5.1 pg_cron Setup

Enable `pg_cron` extension in Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 5.2 Inactive Shop Cleanup

```sql
-- Daily: soft-delete shops inactive > 90 days
SELECT cron.schedule(
  'cleanup-inactive-shops',
  '0 2 * * *',  -- 2 AM daily
  $$
  UPDATE public.shops
  SET is_active = false,
      updated_at = now()
  WHERE is_active = true
    AND updated_at < now() - INTERVAL '90 days'
    AND id != '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;  -- Never delete default shop
  $$
);
```

### 5.3 Orphaned App Settings Cleanup

```sql
-- Weekly: delete app_settings rows with no matching shop
SELECT cron.schedule(
  'cleanup-orphaned-settings',
  '0 3 * * 0',  -- 3 AM every Sunday
  $$
  DELETE FROM public.app_settings
  WHERE shop_id NOT IN (SELECT id FROM public.shops);
  $$
);
```

### 5.4 Stale Draft Sales Cleanup

Shop-configurable via `shops.draft_retention_days` (default 30):

```sql
-- Daily: delete draft sales older than shop's retention period
SELECT cron.schedule(
  'cleanup-stale-drafts',
  '0 4 * * *',  -- 4 AM daily
  $$
  DELETE FROM public.sales
  WHERE status = 'draft'
    AND created_at < now() - (
      SELECT COALESCE(draft_retention_days, 30)
      FROM public.shops
      WHERE id = sales.shop_id
    ) * INTERVAL '1 day';
  $$
);
```

### 5.5 Expired Discounts

Already handled by migration `20260619000001_deactivate_expired_discounts.sql`. No change needed.

### 5.6 Stale Cart Data in Sales Tabs

```sql
-- Weekly: clear cart data in sales_tabs older than 30 days
SELECT cron.schedule(
  'cleanup-stale-carts',
  '0 5 * * 0',  -- 5 AM every Sunday
  $$
  UPDATE public.sales_tabs
  SET cart = '[]'::jsonb,
      selected_customer_id = NULL
  WHERE updated_at < now() - INTERVAL '30 days'
    AND cart != '[]'::jsonb;
  $$
);
```

**Safety:** localStorage is primary cart persistence. DB cart is backup. Clearing DB cart does not affect active sessions.

---

## 6. Implementation Roadmap

### Phase 1: Database Migration

**Goal:** Schema changes + RLS correction. Zero frontend changes.

| Step | Action | Migration |
|------|--------|-----------|
| 1.1 | Add 7 columns to `shops` | `ALTER TABLE shops ADD COLUMN ...` |
| 1.2 | Confirm/add `draft_retention_days` to `shops` | Included with the 8 shop config columns if not already present |
| 1.3 | Backfill default shop from `app_settings` | `UPDATE shops SET tax_rate = ..., currency = ...` |
| 1.4 | Drop 10 columns from `app_settings` | `ALTER TABLE app_settings DROP COLUMN ...` |
| 1.5 | Refactor `generate_invoice_number()` | Add `p_shop_id` parameter |
| 1.6 | ~~Update `auto_generate_invoice_number()` trigger~~ | **DROPPED** (m38) — invoice generation now in `checkout_complete()` RPC |
| 1.7 | Fix RLS: shops UPDATE by shop admin | Replace global admin policy |
| 1.8 | Update `handle_new_auth_user()` trigger | New users get `is_active=false` |
| 1.9 | Install `pg_cron` + schedule cleanup jobs | `CREATE EXTENSION pg_cron` |

**Verification:** Run `npm run lint` + manual test: existing POS still works with default shop.

### Phase 2: Service Layer Refactoring

**Goal:** `shopsService` created, `settingsService` trimmed. No UI changes.

| Step | Action |
|------|--------|
| 2.1 | Add `Shop` interface to `src/types/index.ts` |
| 2.2 | Trim `AppSettings` interface (remove 10 fields) |
| 2.3 | Create `shopsService` in `src/lib/services.ts` |
| 2.4 | Trim `settingsService.get()` and `settingsService.update()` |
| 2.5 | Update `useInvoiceGeneration()` to use DB-backed `invoicesService`/RPC, not frontend counter increments |
| 2.6 | Deprecate frontend `generateNextInvoiceNumber()` for persistence; keep only display helpers if needed |

**Verification:** TypeScript compiles. Service tests pass.

### Phase 3: State & UI Refactoring

**Goal:** All components read from `state.shop` instead of `state.settings` for shop fields.

| Step | Action |
|------|--------|
| 3.1 | Add `shop: Shop` to `AppState` + `SET_SHOP` action in SupabaseAppContext |
| 3.2 | Update `loadData()` to call `shopsService.getByUserId()` |
| 3.3 | Remove invoice counter mutation as normal frontend reducer flow; DB function is source of truth |
| 3.4 | Update `Header.tsx`: `storeName`/`storeLogo` → `shop.name`/`shop.logo` |
| 3.5 | Update `ReceiptPrint.tsx`: 7 fields → `state.shop.*` |
| 3.6 | Update `Cart.tsx`: `currency`/`taxRate` → `shop.*` |
| 3.7 | Update `CheckoutModal.tsx`: `currency`/`taxRate` → `shop.*` |
| 3.8 | Update `ProductGrid.tsx`: `currency` → `shop.currency` |
| 3.9 | Update `InventoryManager.tsx`: `currency` → `shop.currency` |
| 3.10 | Update `CustomerManager.tsx`/`CustomerDetailModal.tsx`: `currency` → `shop.currency` |
| 3.11 | Update `TransactionsManager.tsx`: `currency` → `shop.currency` |
| 3.12 | Update `ReportsManager.tsx`: `currency` → `shop.currency` |
| 3.13 | Update `DiscountManager.tsx`/`DiscountModal.tsx`: `currency` → `shop.currency` |
| 3.14 | Update `POSTerminal.tsx`: `taxRate` → `shop.taxRate` |
| 3.15 | Update `Settings.tsx`: formData reads from `state.shop`, handleSubmit splits to `shopsService` + `settingsService` |
| 3.16 | Update `useInvoiceStats()`: reads from `state.shop` |

**Component dependency table:**

| Component | Fields to change |
|-----------|-----------------|
| `Header.tsx` | `storeName`, `storeLogo` |
| `ReceiptPrint.tsx` | `storeName`, `storeAddress`, `storePhone`, `storeEmail`, `storeLogo`, `currency`, `taxRate` |
| `Cart.tsx` | `currency`, `taxRate`, `interfaceMode` (stays settings) |
| `CheckoutModal.tsx` | `currency`, `taxRate`, `interfaceMode` (stays settings) |
| `POSTerminal.tsx` | `taxRate` |
| `ProductGrid.tsx` | `currency`, `interfaceMode` (stays settings) |
| `InventoryManager.tsx` | `currency` |
| `CustomerManager.tsx` | `currency` |
| `CustomerDetailModal.tsx` | `currency` |
| `TransactionsManager.tsx` | `currency` |
| `ReportsManager.tsx` | `currency` |
| `DiscountManager.tsx` | `currency` |
| `DiscountModal.tsx` | `currency` |
| `Settings.tsx` | All 17 fields split across `shop` + `settings` |

**Verification:** Full manual POS flow: add product → cart → checkout → receipt. Check all currency displays, tax calculations, invoice numbers.

### Phase 4: Governance Features

**Goal:** Approval workflow, anti-bot, cleanup.

| Step | Action |
|------|--------|
| 4.1 | Deploy updated `handle_new_auth_user()` trigger |
| 4.2 | Enable email confirmation in Supabase Dashboard |
| 4.3 | Enable CAPTCHA on signup in Supabase Dashboard |
| 4.4 | Create `PendingApprovalScreen` component |
| 4.5 | Add shop active check in `AppContent.tsx` |
| 4.6 | Create admin approval UI (or document Dashboard workflow) |
| 4.7 | Deploy pg_cron cleanup jobs |
| 4.8 | Add `draft_retention_days` field to Settings UI |

**Verification:** Signup flow → pending screen → admin approves → access granted. Cleanup jobs run on schedule.

---

## 7. Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| RLS write = global admin only → shop admin can't edit settings | Phase 1 Step 1.7: update RLS to shop-admin-scoped |
| `INCREMENT_INVOICE_COUNTER` writes to frontend state | Remove as source-of-truth flow; invoice counter mutation belongs to atomic DB function |
| `useInvoiceGeneration()` calls `settingsService.update()` | Phase 2 Step 2.5: change to DB-backed invoice RPC/service |
| `generate_invoice_number()` no-arg reads `app_settings` | Phase 1 Step 1.5: add `p_shop_id` param, read `shops` |
| Cart in localStorage + `sales_tabs.cart` | Cleanup cron safe: localStorage is primary |
| `handle_new_auth_user()` creates active users | Phase 4 Step 4.1: create pending inactive user/shop/membership for approval gate |
| CheckoutModal hardcoded bank list | Deferred — banks are regional, not shop-specific |

---

## 8. Subscription Tier Management (VISION §3)

### 8.1 Tier Definitions

| Tier | Price | Target Customer |
|------|-------|-----------------|
| **Free** | 0 MMK/month | Small shops, trial users |
| **Growth** | 49,000 MMK/month | Mid-size shops, multi-staff |
| **Pro** | 149,000 MMK/month | High-volume shops, owner needs insights |

### 8.2 Billing Model (VISION §3.4)

Manual High-Touch: Customer contacts Ko Htun → confirms tier → payment via KBZpay/AYApay/UABpay/MMQR → Ko Htun activates in Platform Admin UI.

### 8.3 Grace Period (VISION §3.5)

5 days after subscription expiry. Shop remains fully functional during grace. After grace: automatic downgrade to Free tier features. No data deleted.

### 8.4 Daily Order Limits (VISION §16)

| Tier | Daily Order Limit | Product Limit |
|------|-------------------|---------------|
| Free | 50/day | 50 products |
| Growth | Unlimited | Unlimited |
| Pro | Unlimited | Unlimited |

Enforced server-side in the atomic `checkout_complete` RPC. Concurrent checkouts serialized at shop row level.

## 9. Out of Scope

- Shop switching UI (user belongs to one shop for now)
- Receipt customization (custom footer text, show/hide elements)
- Moving exchange-rate API keys out of `app_settings` into Edge Function secrets/server-side env vars
- New Settings UI layout or sections (existing UI reused as-is)
- Multi-shop membership UI (user sees one shop)
- Stripe/credit card billing integration (manual high-touch until 50+ paying customers)
