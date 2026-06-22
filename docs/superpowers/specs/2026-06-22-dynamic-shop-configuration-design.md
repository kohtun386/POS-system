# Dynamic Shop Configuration System — Design Spec

**Date:** 2026-06-22
**Status:** Approved (Pivoted)
**Approach:** Refactor existing Settings UI to read/write `shops` table instead of `app_settings`

---

## Problem

Store identity (name, address, phone, email) and POS config (tax_rate, currency, invoice settings) live in `app_settings` as a single global row. Multi-tenant shops can't customize their own business profile. Receipt details, currency, tax rate are shared across all shops — breaks multi-tenancy.

## Goals

- **Scalability:** Each shop has its own business profile and POS config.
- **Autonomy:** Shop owners manage their info without developer intervention.
- **Robustness:** POS remains functional with sensible defaults if fields are NULL.

## Scope

**Refactor only.** No new UI components. The existing System Settings page (`src/components/settings/Settings.tsx`) already contains all necessary input fields. The task is to repoint the data source of those existing inputs from `app_settings` to the `shops` table.

What changes:
- Data source: `app_settings` → `shops` table
- Service calls: `settingsService.update()` → `shopsService.update()` for shop-related fields
- State slice: `state.settings` → `state.shop` for store identity and POS config fields
- Consumers: all components reading `state.settings.currency` etc. → `state.shop.currency`

What does NOT change:
- Settings UI layout, sections, field order, input types, labels
- Currency dropdown loading, exchange rate test/update buttons
- Logo upload component
- Permission gating (`canEditSettings`)
- `handleChange`, `handleLogoChange` handlers
- Preferences section (theme, interface mode, printer, backup) — stays in `app_settings`

---

## Data Model

### New `Shop` TypeScript Interface

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
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  isActive: boolean;
  // POS config (moved from app_settings)
  taxRate: number;
  currency: string;
  baseCurrency: string;
  invoicePrefix: string;
  invoiceCounter: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### `shops` Table — New Columns

Add to existing `shops` table (6 columns):

| Column | Type | Default |
|--------|------|---------|
| `logo` | text | NULL |
| `tax_rate` | numeric(5,4) | 0.0000 |
| `currency` | text | 'USD' |
| `base_currency` | text | 'USD' |
| `invoice_prefix` | text | 'INV' |
| `invoice_counter` | integer | 1000 |

Existing columns (`name`, `address`, `phone`, `email`) already present from multi-tenancy migration.

### `app_settings` — Trimmed to Preferences

After migration, `app_settings` keeps ONLY:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | PK |
| `interface_mode` | text | touch/traditional |
| `auto_backup` | boolean | backup toggle |
| `receipt_printer` | boolean | printer toggle |
| `theme` | text | light/dark/auto |
| `exchange_rate_provider` | text | rate provider (stays — out of shop scope) |
| `exchange_rate_api_key` | text | API key (stays — out of shop scope) |
| `exchange_rate_update_interval` | integer | update interval (stays — out of shop scope) |
| `shop_id` | uuid | FK to shops |
| `created_at` | timestamptz | audit |
| `updated_at` | timestamptz | audit |

Removed from `app_settings`: `store_name`, `store_address`, `store_phone`, `store_email`, `store_logo`, `tax_rate`, `currency`, `base_currency`, `invoice_prefix`, `invoice_counter`.

### `AppSettings` Type — Trimmed

```typescript
export interface AppSettings {
  interfaceMode: 'touch' | 'traditional';
  autoBackup: boolean;
  receiptPrinter: boolean;
  theme: 'light' | 'dark' | 'auto';
  exchangeRateProvider?: 'fixer' | 'currencylayer' | 'exchangerate' | 'manual';
  exchangeRateApiKey?: string;
  exchangeRateUpdateInterval?: number;
}
```

### Fallback Logic

Shop fields use hardcoded defaults when NULL:

```
shop.name ?? 'CoffeeShop POS'
shop.address ?? ''
shop.phone ?? ''
shop.email ?? ''
shop.currency ?? 'USD'
shop.taxRate ?? 0
shop.invoicePrefix ?? 'INV'
shop.invoiceCounter ?? 1000
```

No fallback chain to `app_settings`. If shop field is NULL, use default. Simple.

---

## Service Layer

### New `shopsService`

```typescript
export const shopsService = {
  async getByUserId(userId: string): Promise<Shop> {
    // 1. Get user's active shop_id from shop_memberships
    const { data: membership } = await supabase
      .from('shop_memberships')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    // 2. Load shop
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', membership.shop_id)
      .single();

    if (error) throw error;

    // 3. Map snake_case → camelCase with defaults
    return {
      id: data.id,
      name: data.name || 'CoffeeShop POS',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      logo: data.logo || undefined,
      ownerId: data.owner_id || undefined,
      subscriptionTier: data.subscription_tier || 'free',
      isActive: data.is_active ?? true,
      taxRate: data.tax_rate ?? 0,
      currency: data.currency || 'USD',
      baseCurrency: data.base_currency || 'USD',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter ?? 1000,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async update(id: string, shop: Partial<Shop>): Promise<Shop> {
    // Map camelCase → snake_case
    const updateData: any = {};
    if (shop.name !== undefined) updateData.name = shop.name;
    if (shop.address !== undefined) updateData.address = shop.address;
    if (shop.phone !== undefined) updateData.phone = shop.phone;
    if (shop.email !== undefined) updateData.email = shop.email;
    if (shop.logo !== undefined) updateData.logo = shop.logo;
    if (shop.taxRate !== undefined) updateData.tax_rate = shop.taxRate;
    if (shop.currency !== undefined) updateData.currency = shop.currency;
    if (shop.baseCurrency !== undefined) updateData.base_currency = shop.baseCurrency;
    if (shop.invoicePrefix !== undefined) updateData.invoice_prefix = shop.invoicePrefix;
    if (shop.invoiceCounter !== undefined) updateData.invoice_counter = shop.invoiceCounter;

    const { data, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return mapShopRow(data);
  }
}
```

### `settingsService` — Trimmed

`get()` and `update()` only handle: `interface_mode`, `auto_backup`, `receipt_printer`, `theme`, `exchange_rate_*`. All store identity and POS config columns removed from queries.

---

## Context / State Management

### AppState Changes

```typescript
interface AppState {
  shop: Shop;            // NEW — business identity + POS config
  settings: AppSettings; // TRIMMED — preferences only
  activeShopId: string;
  // ... rest unchanged
}
```

### New Action

```typescript
type AppAction =
  | { type: 'SET_SHOP'; payload: Shop }
  // ... existing actions
```

### Initial State

```typescript
const initialState = {
  shop: {
    id: '',
    name: 'CoffeeShop POS',
    address: '',
    phone: '',
    email: '',
    taxRate: 0,
    currency: 'LKR',
    baseCurrency: 'USD',
    invoicePrefix: 'INV',
    invoiceCounter: 1000,
    subscriptionTier: 'free',
    isActive: true,
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

### Reducer

```typescript
case 'SET_SHOP':
  return { ...state, shop: { ...state.shop, ...action.payload } };
case 'INCREMENT_INVOICE_COUNTER':
  return { ...state, shop: { ...state.shop, invoiceCounter: action.payload } };
```

### Data Loading

```typescript
async function loadData() {
  const [shop, settings, products, customers, sales, discounts, users, salesTabs] =
    await Promise.all([
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

---

## Settings UI — No Layout Changes

The existing Settings page is reused as-is. Only the data source changes.

### Current Form Fields → New Source

| Form Field | Current Source | New Source | Section (unchanged) |
|---|---|---|---|
| `storeName` | `state.settings.storeName` | `state.shop.name` | Store Information |
| `storePhone` | `state.settings.storePhone` | `state.shop.phone` | Store Information |
| `storeEmail` | `state.settings.storeEmail` | `state.shop.email` | Store Information |
| `storeAddress` | `state.settings.storeAddress` | `state.shop.address` | Store Information |
| `storeLogo` | `state.settings.storeLogo` | `state.shop.logo` | Store Information |
| `currency` | `state.settings.currency` | `state.shop.currency` | Store Information |
| `baseCurrency` | `state.settings.baseCurrency` | `state.shop.baseCurrency` | Store Information |
| `taxRate` | `state.settings.taxRate` | `state.shop.taxRate` | Financial Settings |
| `invoicePrefix` | `state.settings.invoicePrefix` | `state.shop.invoicePrefix` | Invoice Settings |
| `invoiceCounter` | `state.settings.invoiceCounter` | `state.shop.invoiceCounter` | Invoice Settings |
| `exchangeRateProvider` | `state.settings.exchangeRateProvider` | `state.settings.exchangeRateProvider` | Exchange Rate (no change) |
| `exchangeRateApiKey` | `state.settings.exchangeRateApiKey` | `state.settings.exchangeRateApiKey` | Exchange Rate (no change) |
| `exchangeRateUpdateInterval` | `state.settings.exchangeRateUpdateInterval` | `state.settings.exchangeRateUpdateInterval` | Exchange Rate (no change) |
| `receiptPrinter` | `state.settings.receiptPrinter` | `state.settings.receiptPrinter` | Hardware (no change) |
| `autoBackup` | `state.settings.autoBackup` | `state.settings.autoBackup` | Hardware (no change) |
| `theme` | `state.settings.theme` | `state.settings.theme` | System Preferences (no change) |

### Changes to Settings.tsx

Only 3 areas change:

1. **`formData` initial values** — 10 fields read from `state.shop` instead of `state.settings`:
   ```typescript
   storeName: state.shop.name,           // was state.settings.storeName
   storeAddress: state.shop.address,     // was state.settings.storeAddress
   storePhone: state.shop.phone,         // was state.settings.storePhone
   storeEmail: state.shop.email,         // was state.settings.storeEmail
   storeLogo: state.shop.logo,           // was state.settings.storeLogo
   taxRate: state.shop.taxRate.toString(), // was state.settings.taxRate
   currency: state.shop.currency,        // was state.settings.currency
   baseCurrency: state.shop.baseCurrency, // was state.settings.baseCurrency
   invoicePrefix: state.shop.invoicePrefix, // was state.settings.invoicePrefix
   invoiceCounter: state.shop.invoiceCounter?.toString(), // was state.settings.invoiceCounter
   ```

2. **`handleSubmit`** — split into two service calls:
   ```typescript
   // Shop fields → shopsService
   await shopsService.update(state.shop.id, {
     name: formData.storeName,
     address: formData.storeAddress,
     phone: formData.storePhone,
     email: formData.storeEmail,
     logo: formData.storeLogo,
     taxRate: parseFloat(formData.taxRate),
     currency: formData.currency,
     baseCurrency: formData.baseCurrency,
     invoicePrefix: formData.invoicePrefix,
     invoiceCounter: parseInt(formData.invoiceCounter),
   });
   dispatch({ type: 'SET_SHOP', payload: shopUpdates });

   // Preference fields → settingsService (unchanged)
   await settingsService.update({
     interfaceMode: ...,
     autoBackup: ...,
     receiptPrinter: ...,
     theme: ...,
     exchangeRateProvider: ...,
     exchangeRateApiKey: ...,
     exchangeRateUpdateInterval: ...,
   });
   dispatch({ type: 'SET_SETTINGS', payload: prefsUpdates });
   ```

3. **`useInvoiceStats`** — reads from `state.shop` instead of `state.settings`.

---

## Receipt Component

`ReceiptContent` reads from `state.shop` instead of `state.settings`:

| Before | After |
|--------|-------|
| `state.settings.storeName` | `state.shop.name` |
| `state.settings.storeAddress` | `state.shop.address` |
| `state.settings.storePhone` | `state.shop.phone` |
| `state.settings.storeEmail` | `state.shop.email` |
| `state.settings.storeLogo` | `state.shop.logo` |
| `state.settings.currency` | `state.shop.currency` |
| `state.settings.taxRate` | `state.shop.taxRate` |

---

## Components Requiring `state.settings` → `state.shop` Updates

| Component | Fields | Change |
|-----------|--------|--------|
| `Header.tsx` | `storeName`, `storeLogo` | → `shop.name`, `shop.logo` |
| `ProductGrid.tsx` | `currency` | → `shop.currency` |
| `Cart.tsx` | `currency`, `taxRate` | → `shop.currency`, `shop.taxRate` |
| `CheckoutModal.tsx` | `currency`, `taxRate` | → `shop.currency`, `shop.taxRate` |
| `InventoryManager.tsx` | `currency` | → `shop.currency` |
| `CustomerManager.tsx` | `currency` | → `shop.currency` |
| `CustomerDetailModal.tsx` | `currency` | → `shop.currency` |
| `TransactionsManager.tsx` | `currency` | → `shop.currency` |
| `ReportsManager.tsx` | `currency` | → `shop.currency` |
| `DiscountManager.tsx` | `currency` | → `shop.currency` |
| `DiscountModal.tsx` | `currency` | → `shop.currency` |
| `useInvoiceGeneration()` | `invoiceCounter`, `invoicePrefix` | → `shop.*` |
| `generateNextInvoiceNumber()` | `settings` param | → `shop` param |

---

## Migration Strategy

Single migration file.

### Sequence

1. Add new columns to `shops` (with defaults)
2. Backfill from `app_settings` (single row → default shop)
3. Drop store identity + POS config columns from `app_settings`

### SQL

```sql
-- 1. Add columns
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,4) DEFAULT 0.0000;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'USD';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS invoice_counter INTEGER DEFAULT 1000;

-- 2. Backfill from app_settings
UPDATE shops SET
  tax_rate = COALESCE((SELECT tax_rate FROM app_settings LIMIT 1), 0),
  currency = COALESCE((SELECT currency FROM app_settings LIMIT 1), 'USD'),
  base_currency = COALESCE((SELECT base_currency FROM app_settings LIMIT 1), 'USD'),
  invoice_prefix = COALESCE((SELECT invoice_prefix FROM app_settings LIMIT 1), 'INV'),
  invoice_counter = COALESCE((SELECT invoice_counter FROM app_settings LIMIT 1), 1000)
WHERE id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5';

-- 3. Drop columns from app_settings
ALTER TABLE app_settings DROP COLUMN IF EXISTS store_name;
ALTER TABLE app_settings DROP COLUMN IF EXISTS store_address;
ALTER TABLE app_settings DROP COLUMN IF EXISTS store_phone;
ALTER TABLE app_settings DROP COLUMN IF EXISTS store_email;
ALTER TABLE app_settings DROP COLUMN IF EXISTS store_logo;
ALTER TABLE app_settings DROP COLUMN IF EXISTS tax_rate;
ALTER TABLE app_settings DROP COLUMN IF EXISTS currency;
ALTER TABLE app_settings DROP COLUMN IF EXISTS base_currency;
ALTER TABLE app_settings DROP COLUMN IF EXISTS invoice_prefix;
ALTER TABLE app_settings DROP COLUMN IF EXISTS invoice_counter;
```

### Risk

Dropping columns from `app_settings` is destructive and one-way. Backup before running.

### Implementation Order

1. Migration (schema changes)
2. Types (`Shop` interface, trim `AppSettings`)
3. Service layer (`shopsService`, trim `settingsService`)
4. Context (`SET_SHOP` action, `state.shop`, trim `state.settings`, update `loadData`)
5. Components (all `state.settings.currency` → `state.shop.currency` etc.)
6. Settings UI (repoint formData initial values + handleSubmit)
7. Receipt (`ReceiptContent` reads from `state.shop`)
8. Lint + type check

---

## Out of Scope

- Shop switching UI (user belongs to one shop for now)
- Shop creation/management UI (admin creates shops via Supabase Dashboard)
- Receipt customization (custom footer text, show/hide elements)
- Per-shop user role management (roles stay global in `users` table)
- Exchange rate configuration (stays in `app_settings` — not shop-specific)
- New Settings UI layout or sections (existing UI reused as-is)
