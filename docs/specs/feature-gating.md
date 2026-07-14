# Feature Gating — Implementation Guide

**Status:** Spec complete, implementation pending
**Last updated:** 2026-07-14 (aligned with VISION.md v3.1.0)
**Canonical source of truth:** `docs/specs/tier-spec.md` — this document describes implementation details only.
**Depends on:** Multi-tenancy foundation (`docs/specs/multi-tenancy.md`), Dynamic shop configuration (`docs/specs/dynamic-configuration.md`)

---

## 1. Problem

Features like receipt printing, cash drawer management, and owner insights are currently hard-coded as always-on. A Free tier shop shouldn't see printer settings. A Growth tier shop shouldn't see P&L dashboards. We need per-shop feature control driven by subscription tier — without code changes or migrations.

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | **Capability-based, server-side resolution** | Server resolves all feature logic. Client receives flat `capabilities: string[]`. No tier/type conditionals in component code. (VISION §5.1) |
| Granularity | Capability strings, not boolean flags | Simpler client contract. Components check `capabilities.includes('key')`. |
| Resolution | At login time | Server reads shop's subscription tier, business type, and per-shop overrides. Returns flat capability list. (VISION §5.2) |
| Two gates | Subscription tier + business type defaults | Both are server-side. Default resolution checks tier level first, but per-shop overrides can bypass tier gates. (TIER-SPEC §3.3) |
| Storage | Dedicated tables (`feature_definitions`, `shop_features`) | Queryable across shops, referential integrity, admin UI is straightforward |
| Override | Per-shop `shop_features` table | Only rows that deviate from default are stored |
| Override precedence | **Flexible** | Platform admins can override tier gates — e.g., enable a Pro feature on a Free shop for trials. `shop_features` always wins over `feature_definitions` defaults. (TIER-SPEC §3.3) |
| Platform admin | Edge Function only | `feature_definitions` writable by `platform_admin` via `service_role` key. No RLS bypass. (VISION §4.3) |

## 3. Schema

### 3.1 `feature_definitions` — Platform-Level Feature Catalog

```sql
CREATE TABLE feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  default_enabled BOOLEAN NOT NULL DEFAULT true,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'growth', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Purpose |
|---|---|---|
| `key` | TEXT UNIQUE | Machine-readable identifier (see capability keys below) |
| `name` | TEXT | Human-readable: "Receipt Printing" |
| `description` | TEXT | What this feature does |
| `category` | TEXT | Grouping for admin UI: `pos`, `inventory`, `kitchen`, `payments`, `customers`, `general` |
| `default_enabled` | BOOLEAN | Default state for new shops |
| `subscription_tier` | TEXT | Minimum tier required: `free`, `growth`, `pro` (VISION §3.1) |

### 3.2 Capability Keys (VISION.md §5.5 — Canonical, 18 keys)

**Free Tier (9 keys — always available):**

| Capability | Description | Notes |
|------------|-------------|-------|
| `pos` | POS terminal | Implicit — always available, no DB row needed |
| `inventory` | Stock tracking | |
| `discounts` | Discount engine | |
| `draft_sales` | Draft/pending sales | |
| `customer_management` | Customer records | |
| `batch_tracking` | Batch/lot tracking | Embedded in ProductModal, no standalone component |
| `weight_based_products` | Per-unit pricing | Embedded in ProductModal, no standalone component |
| `credit_system` | Customer credit tracking | Embedded in POS, no standalone component |
| `multi_tab_sales` | Multi-tab POS workflow | Embedded in SalesTabManager, no standalone component |

**Growth Tier (6 keys — adds operational tools):**

| Capability | Description | Notes |
|------------|-------------|-------|
| `printer_integration` | Thermal printer | Bluetooth/Network |
| `purchase_log` | Purchase recording | Simplified inventory: record what was bought |
| `stock_overview` | Stock levels & adjustments | Manual entry, not auto-calculated |
| `low_stock_alerts` | Threshold-based alerts | "coffee beans below 2 kg → alert" |
| `staff_accounts` | Multiple staff logins | |
| `cash_drawer` | Shift start/end | Shift management, variance tracking |

**Pro Tier (3 keys — adds analytics):**

| Capability | Description | Notes |
|------------|-------------|-------|
| `owner_insights` | P&L dashboard | Revenue − Purchases monthly view |
| `simple_profit_report` | Revenue − Purchases | Monthly profit calculation, no per-recipe COGS |
| `advanced_reports` | Consolidated Pro reports gate | Gates owner_insights, simple_profit_report |

> Note: `pos` is implicit (always available) and has no DB row.

### 3.3 Seed Data

```sql
INSERT INTO feature_definitions (key, name, category, default_enabled, subscription_tier) VALUES
  -- Free tier capabilities (9 keys, always available)
  ('inventory',           'Stock Tracking',          'inventory',  true,  'free'),
  ('discounts',           'Discount Engine',         'pos',        true,  'free'),
  ('draft_sales',         'Draft Sales',             'pos',        true,  'free'),
  ('customer_management', 'Customer Management',     'customers',  true,  'free'),
  ('batch_tracking',      'Batch/Lot Tracking',      'inventory',  true,  'free'),
  ('weight_based_products','Weight-Based Products',  'inventory',  true,  'free'),
  ('credit_system',       'Customer Credit System',  'customers',  true,  'free'),
  ('multi_tab_sales',     'Multi-Tab Sales',         'pos',        true,  'free'),
  -- Growth tier capabilities (6 keys)
  ('printer_integration', 'Thermal Printer',         'pos',        true,  'growth'),
  ('purchase_log',        'Purchase Recording',      'inventory',  true,  'growth'),
  ('stock_overview',      'Stock Overview',          'inventory',  true,  'growth'),
  ('low_stock_alerts',    'Low Stock Alerts',        'inventory',  true,  'growth'),
  ('staff_accounts',      'Multiple Staff Accounts', 'general',    true,  'growth'),
  ('cash_drawer',         'Cash Drawer / Shift Mgmt','pos',        true,  'growth'),
  -- Pro tier capabilities (3 keys)
  ('owner_insights',      'Owner Insights (P&L)',    'reports',    false, 'pro'),
  ('simple_profit_report','Simple Profit Report',    'reports',    false, 'pro'),
  ('advanced_reports',    'Advanced Reports',        'reports',    false, 'pro');
```

> **Note:** `pos` is implicit (always available) and has no DB row. 18 keys total: 9 free, 6 growth, 3 pro (VISION.md §5.5).

### 3.4 `shop_features` — Per-Shop Overrides

```sql
CREATE TABLE shop_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES feature_definitions(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, feature_key)
);
```

Only rows that **deviate from the default** are stored. If a feature has no row in `shop_features`, the `feature_definitions.default_enabled` value applies.

### 3.5 Indexes

```sql
CREATE INDEX idx_shop_features_shop_id ON shop_features(shop_id);
CREATE INDEX idx_shop_features_feature_key ON shop_features(feature_key);
CREATE INDEX idx_feature_definitions_category ON feature_definitions(category);
```

### 3.6 RLS Policies

```sql
-- feature_definitions: readable by all, writable by platform admin only (via Edge Function)
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature definitions viewable by all authenticated" ON feature_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

-- feature_definitions: no direct write policy for client roles.
-- Platform admin writes via Edge Function using service_role key (bypasses RLS).
-- See VISION §4.3, §17.

-- shop_features: readable by shop members, writable by shop admin
ALTER TABLE shop_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop features viewable by shop members" ON shop_features
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Shop features writable by shop admin" ON shop_features
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.shop_id = shop_features.shop_id AND sm.role = 'admin'
    )
  );
```

## 4. Server-Side Capability Resolution (VISION §5)

### 4.1 Resolution Flow

At login time, the server resolves capabilities. The client receives a flat `capabilities: string[]` array. No tier/type conditionals exist in component code.

```
Login time
  │
  ▼
Server reads: shop.subscription_tier, shop.business_type, shop_features overrides
  │
  ▼
For each feature_definitions row:
  │
  ├─ Check per-shop override (shop_features)
  │   → If override exists: use override value (ENABLED or DISABLED)
  │   → Overrides ALWAYS win — can enable Growth/Pro features on Free shops (TIER-SPEC §3.3)
  │
  ├─ If no override: check tier gate
  │   → Feature's subscription_tier level ≤ shop's tier level? → use default_enabled
  │   → Feature's subscription_tier level > shop's tier level? → disabled
  │
  └─ Append enabled features to capabilities array
  │
  ▼
Result: flat string[] → ['pos', 'inventory', 'discounts', ...]
  │
  ▼
Returned to client, stored in AppState.capabilities
```

**Override Precedence (TIER-SPEC §3.3):**
```
shop_features override > feature_definitions.default_enabled + tier gate
```
Platform admins can override tier gates — e.g., enable a Pro feature on a Free shop for trials.

### 4.2 Resolution Implementation

```sql
-- Supabase Edge Function or RPC: resolve_capabilities(p_shop_id UUID)
-- Returns: text[] of capability keys
-- Precedence: shop_features override > feature_definitions tier gate + default_enabled
-- (TIER-SPEC §3.3 — Flexible model: overrides CAN beat tier gates)

CREATE OR REPLACE FUNCTION resolve_capabilities(p_shop_id UUID)
RETURNS TEXT[]
SET search_path = ''
AS $$
DECLARE
  v_tier TEXT;
  v_capabilities TEXT[] := '{}';
  v_def RECORD;
  v_override BOOLEAN;
  v_tier_level INTEGER;
  v_def_tier_level INTEGER;
BEGIN
  -- Get shop tier
  SELECT subscription_tier INTO v_tier
  FROM public.shops
  WHERE id = p_shop_id;

  -- Tier level mapping
  v_tier_level := CASE v_tier
    WHEN 'free' THEN 0
    WHEN 'growth' THEN 1
    WHEN 'pro' THEN 2
    ELSE 0
  END;

  -- For each feature definition
  FOR v_def IN
    SELECT key, subscription_tier, default_enabled
    FROM public.feature_definitions
    ORDER BY key
  LOOP
    -- Check per-shop override FIRST (overrides always win)
    SELECT enabled INTO v_override
    FROM public.shop_features
    WHERE shop_id = p_shop_id AND feature_key = v_def.key;

    IF v_override IS NOT NULL THEN
      -- Override exists: use it regardless of tier gate
      IF v_override THEN
        v_capabilities := array_append(v_capabilities, v_def.key);
      END IF;
    ELSE
      -- No override: apply tier gate
      v_def_tier_level := CASE v_def.subscription_tier
        WHEN 'free' THEN 0
        WHEN 'growth' THEN 1
        WHEN 'pro' THEN 2
        ELSE 0
      END;

      IF v_tier_level >= v_def_tier_level AND v_def.default_enabled THEN
        v_capabilities := array_append(v_capabilities, v_def.key);
      END IF;
    END IF;
  END LOOP;

  RETURN v_capabilities;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Client-Side Contract

The client stores a `capabilities: string[]` array. Components check this array to show/hide features.

```typescript
// In AppState
interface AppState {
  capabilities: string[];
  // ... other fields
}

// Component usage
const { state } = useApp();
if (state.capabilities.includes('printer_integration')) {
  // Show printer settings
}
```

**Prohibited patterns in components:**
- Checking `shop.subscriptionTier` directly
- Checking `shop.businessType` directly
- Reading `feature_definitions` table client-side
- Checking `featureFlags[key]` (old pattern — use `capabilities.includes(key)`)

## 5. TypeScript Interfaces

```typescript
// src/types/index.ts

export interface FeatureDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: string;
  defaultEnabled: boolean;
  subscriptionTier: 'free' | 'growth' | 'pro';
  createdAt: Date;
}

export interface ShopFeature {
  id: string;
  shopId: string;
  featureKey: string;
  enabled: boolean;
  updatedAt: Date;
}

// Resolved capabilities for runtime use
export type Capabilities = string[];
```

## 6. Service Layer

```typescript
// src/lib/services.ts

export const featureDefinitionsService = {
  async getAll(): Promise<FeatureDefinition[]> { ... },
  // Platform admin only — writes via Edge Function, not direct client call
};

export const shopFeaturesService = {
  async getByShopId(shopId: string): Promise<ShopFeature[]> { ... },

  async setFeature(shopId: string, featureKey: string, enabled: boolean): Promise<ShopFeature> {
    // UPSERT: INSERT or UPDATE on conflict (shop_id, feature_key)
    const { data, error } = await supabase
      .from('shop_features')
      .upsert(
        { shop_id: shopId, feature_key: featureKey, enabled },
        { onConflict: 'shop_id,feature_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return mapShopFeatureRow(data);
  },

  async deleteFeature(shopId: string, featureKey: string): Promise<void> {
    // Removes override, reverts to default
    const { error } = await supabase
      .from('shop_features')
      .delete()
      .eq('shop_id', shopId)
      .eq('feature_key', featureKey);
    if (error) throw error;
  },
};
```

## 7. State Management

### 7.1 Resolve Capabilities on Load

```typescript
// In SupabaseAppContext.tsx — loadData()

// Capabilities are resolved server-side via RPC
const { data: capabilities } = await supabase
  .rpc('resolve_capabilities', { p_shop_id: shop.id });

dispatch({ type: 'SET_CAPABILITIES', payload: capabilities || [] });
```

### 7.2 AppState Addition

```typescript
interface AppState {
  // ... existing fields
  capabilities: string[];  // Resolved capability keys
}
```

### 7.3 New Action

```typescript
| { type: 'SET_CAPABILITIES'; payload: string[] }
```

### 7.4 Reducer

```typescript
case 'SET_CAPABILITIES':
  return { ...state, capabilities: action.payload };
```

## 8. Component Usage

### 8.1 Capability Check Hook

```typescript
// src/hooks/useCapability.ts

export function useCapability(key: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(key);
}

export function useCapabilities(): string[] {
  const { state } = useApp();
  return state.capabilities;
}
```

### 8.2 Conditional Rendering

```tsx
// In Settings.tsx — show printer settings only for Growth+
const hasPrinter = useCapability('printer_integration');
{hasPrinter && <PrinterSettings />}

// In Header.tsx — hide nav item
const hasCashDrawer = useCapability('cash_drawer');
{hasCashDrawer && <NavItem label="Shifts" view="shifts" />}

// In CheckoutModal.tsx — show receipt print option
const hasPrinter = useCapability('printer_integration');
{hasPrinter && <PrintReceiptToggle />}
```

### 8.3 Admin UI — Feature Definitions Page (Platform Admin)

A new component `FeatureDefinitions.tsx` accessible only to `platform_admin` via Edge Function:

- Table grouped by category (POS, Inventory, Kitchen, Customers, General)
- Each row: feature name, description, current default state (toggle)
- Toggle calls `supabase.functions.invoke('platform-admin-manage-features', ...)`
- Subscription tier badge shown per feature
- Per-shop overrides visible in Shop Detail view

## 9. Feature Gate Summary by Tier

> Derived from `tier-spec.md §2.1` — canonical source.

### 9.1 Free Tier (9 features)

| Capability | Available | Notes |
|------------|-----------|-------|
| `pos` | ✅ | POS terminal (implicit, no DB row) |
| `inventory` | ✅ | Stock tracking |
| `discounts` | ✅ | Discount engine |
| `draft_sales` | ✅ | Draft/pending sales |
| `customer_management` | ✅ | Customer records |
| `batch_tracking` | ✅ | Embedded in ProductModal |
| `weight_based_products` | ✅ | Embedded in ProductModal |
| `credit_system` | ✅ | Embedded in POS |
| `multi_tab_sales` | ✅ | Embedded in SalesTabManager |

### 9.2 Growth Tier (15 features)

All Free capabilities PLUS:

| Capability | Available | Notes |
|------------|-----------|-------|
| `printer_integration` | ✅ | Bluetooth/Network thermal printer |
| `purchase_log` | ✅ | Simplified inventory: record purchases |
| `stock_overview` | ✅ | Current supply levels, manual adjustments |
| `low_stock_alerts` | ✅ | Threshold-based notifications |
| `staff_accounts` | ✅ | Multiple staff logins |
| `cash_drawer` | ✅ | Shift start/end, variance tracking |

### 9.3 Pro Tier (18 active features)

All Growth capabilities PLUS:

| Capability | Available | Notes |
|------------|-----------|-------|
| `owner_insights` | ✅ | P&L dashboard (Revenue − Purchases) |
| `simple_profit_report` | ✅ | Monthly profit report |
| `advanced_reports` | ✅ | Consolidated Pro reports gate |

### 9.4 Total: 18 Capability Keys

18 keys across 3 tiers (VISION.md §5.5). No dead/reserved keys in v3.1.0 scope.

### 9.5 Platform Admin Override

Platform admins can override tier gates via `shop_features` — e.g., enable `owner_insights` (Pro) on a Free shop for trials. Overrides always win over tier defaults (TIER-SPEC §3.3).

## 10. Migration

```sql
-- Feature flags migration

CREATE TABLE feature_definitions ( ... );
CREATE TABLE shop_features ( ... );
CREATE INDEX idx_shop_features_shop_id ON shop_features(shop_id);
CREATE INDEX idx_shop_features_feature_key ON shop_features(feature_key);
CREATE INDEX idx_feature_definitions_category ON feature_definitions(category);
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_features ENABLE ROW LEVEL SECURITY;
-- RLS policies ...
-- Seed data INSERT ...
-- resolve_capabilities() function ...
```

## 11. Implementation Phases

| Phase | Scope | Effort |
|---|---|---|
| 1 | Migration: tables, indexes, RLS, seed data, `resolve_capabilities()` RPC | 45 min |
| 2 | Service layer: `featureDefinitionsService`, `shopFeaturesService` | 1 hour |
| 3 | State: `capabilities` in AppState, resolve on load via RPC | 30 min |
| 4 | Hook: `useCapability()`, `useCapabilities()` | 15 min |
| 5 | Component guards: wrap existing features with capability checks | 2 hours |
| 6 | Platform Admin UI: `FeatureDefinitions` component (via Edge Function) | 2 hours |

**Total: ~6.5 hours**

---

## Related Documents

- **[tier-spec.md](tier-spec.md)** — **Canonical source of truth** for tier definitions, capability mapping, and override rules
- [VISION.md](../vision/VISION.md) — Section 5: Feature Flag Architecture (business vision)
- [Multi-Tenancy](multi-tenancy.md) — shop_id foundation, subscription tiers, role model
- [Dynamic Shop Configuration](dynamic-configuration.md) — shops table, subscription_tier column
- [Database Architecture](../architecture/database.md) — feature_definitions, shop_features schema
- [State Management](../architecture/state-management.md) — capabilities in AppState
