# Feature Flags — Per-Shop Feature Toggling

**Status:** Spec complete, implementation pending
**Date:** 2026-06-24
**Depends on:** Multi-tenancy foundation (`docs/specs/multi-tenancy.md`), Dynamic shop configuration (`docs/specs/dynamic-shop-configuration.md`)

---

## 1. Problem

Features like inventory tracking, credit system, kitchen display, and online ordering are currently hard-coded as always-on. A pharmacy shop doesn't need a kitchen display. A retail kiosk doesn't need a credit system. We need per-shop feature control without code changes or migrations.

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Granularity | Simple per-shop boolean toggles | Covers 90% of real needs. No rollout percentages, no A/B testing. |
| Storage | Dedicated tables (not JSONB on `shops`) | Queryable across shops ("which shops have X?"), referential integrity, admin UI is straightforward |
| Default behavior | `feature_definitions.default_enabled` | New shops get sensible defaults. Overrides via `shop_features` only when deviating. |
| Subscription gating | Optional layer, not enforced in v1 | `subscription_tier` column on `feature_definitions` for future use. v1 = all flags available to all shops. |

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
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Column | Type | Purpose |
|---|---|---|
| `key` | TEXT UNIQUE | Machine-readable identifier: `inventory_tracking`, `credit_system`, `kitchen_display`, `online_ordering`, `multi_currency`, `discount_engine`, `customer_management`, `batch_tracking`, `weight_based_products`, `draft_sales`, `multi_tab_sales` |
| `name` | TEXT | Human-readable: "Inventory Tracking" |
| `description` | TEXT | What this feature does |
| `category` | TEXT | Grouping for admin UI: `pos`, `inventory`, `kitchen`, `payments`, `customers`, `general` |
| `default_enabled` | BOOLEAN | Default state for new shops |
| `subscription_tier` | TEXT | Minimum tier required: `free`, `pro`, `enterprise`. Future use. |

**Seed data** (migration):

```sql
INSERT INTO feature_definitions (key, name, category, default_enabled, subscription_tier) VALUES
  ('inventory_tracking',   'Inventory Tracking',     'inventory',  true,  'free'),
  ('batch_tracking',       'Batch Tracking',         'inventory',  true,  'free'),
  ('weight_based_products','Weight-Based Products',   'inventory',  true,  'free'),
  ('customer_management',  'Customer Management',     'customers',  true,  'free'),
  ('credit_system',        'Customer Credit System',  'customers',  true,  'free'),
  ('discount_engine',      'Discount Engine',         'pos',        true,  'free'),
  ('multi_currency',       'Multi-Currency Support',  'general',    true,  'free'),
  ('draft_sales',          'Draft Sales',             'pos',        true,  'free'),
  ('multi_tab_sales',      'Multi-Tab Sales',         'pos',        true,  'free'),
  ('kitchen_display',      'Kitchen Display System',  'kitchen',    false, 'pro'),
  ('online_ordering',      'Online Ordering',         'pos',        false, 'pro'),
  ('advanced_reports',     'Advanced Reports',        'general',    false, 'pro'),
  ('supplier_management',  'Supplier Management',     'inventory',  false, 'pro');
```

### 3.2 `shop_features` — Per-Shop Overrides

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

### 3.3 Indexes

```sql
CREATE INDEX idx_shop_features_shop_id ON shop_features(shop_id);
CREATE INDEX idx_shop_features_feature_key ON shop_features(feature_key);
CREATE INDEX idx_feature_definitions_category ON feature_definitions(category);
```

### 3.4 RLS Policies

```sql
-- feature_definitions: readable by all, writable by platform admin only
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature definitions viewable by all authenticated" ON feature_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Feature definitions writable by platform admin" ON feature_definitions
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

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

## 4. TypeScript Interfaces

```typescript
// src/types/index.ts

export interface FeatureDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: string;
  defaultEnabled: boolean;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
}

export interface ShopFeature {
  id: string;
  shopId: string;
  featureKey: string;
  enabled: boolean;
  updatedAt: Date;
}

// Resolved flags for runtime use
export type FeatureFlags = Record<string, boolean>;
```

## 5. Service Layer

```typescript
// src/lib/services.ts

export const featureDefinitionsService = {
  async getAll(): Promise<FeatureDefinition[]> { ... },
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

## 6. State Management

### 6.1 Resolve Flags on Load

```typescript
// In SupabaseAppContext.tsx — loadData()

const [definitions, overrides] = await Promise.all([
  featureDefinitionsService.getAll(),
  shopFeaturesService.getByShopId(shop.id),
]);

const featureFlags: FeatureFlags = {};
for (const def of definitions) {
  const override = overrides.find(o => o.featureKey === def.key);
  featureFlags[def.key] = override ? override.enabled : def.defaultEnabled;
}

dispatch({ type: 'SET_FEATURE_FLAGS', payload: featureFlags });
```

### 6.2 AppState Addition

```typescript
interface AppState {
  // ... existing fields
  featureFlags: FeatureFlags;  // Record<string, boolean>
}
```

### 6.3 New Action

```typescript
| { type: 'SET_FEATURE_FLAGS'; payload: FeatureFlags }
| { type: 'TOGGLE_FEATURE_FLAG'; payload: { key: string; enabled: boolean } }
```

### 6.4 Reducer

```typescript
case 'SET_FEATURE_FLAGS':
  return { ...state, featureFlags: action.payload };

case 'TOGGLE_FEATURE_FLAG':
  return {
    ...state,
    featureFlags: { ...state.featureFlags, [action.payload.key]: action.payload.enabled }
  };
```

## 7. Component Usage

### 7.1 Feature Gate Hook

```typescript
// src/hooks/useFeatureFlag.ts

export function useFeatureFlag(key: string): boolean {
  const { state } = useApp();
  return state.featureFlags[key] ?? false;
}

export function useFeatureFlags(): FeatureFlags {
  const { state } = useApp();
  return state.featureFlags;
}
```

### 7.2 Conditional Rendering

```tsx
// In InventoryManager.tsx
const inventoryEnabled = useFeatureFlag('inventory_tracking');
if (!inventoryEnabled) return null;

// In Header.tsx — hide nav item
const kitchenEnabled = useFeatureFlag('kitchen_display');
{kitchenEnabled && <NavItem label="Kitchen" view="kitchen" />}

// In CheckoutModal.tsx — disable credit payment
const creditEnabled = useFeatureFlag('credit_system');
{creditEnabled && <PaymentMethodButton method="credit" />}
```

### 7.3 Admin UI — Feature Flags Page

A new component `FeatureFlagsManager.tsx` accessible only to admin role:

- Table grouped by category (POS, Inventory, Kitchen, Customers, General)
- Each row: feature name, description, current state (toggle)
- Toggle calls `shopFeaturesService.setFeature(shopId, key, enabled)`
- "Reset to defaults" button deletes all overrides for the shop
- Subscription tier badge shown (future: grayed out if tier too low)

## 8. Subscription Gating (Future — v1 Does Not Enforce)

When ready to enforce:

```typescript
// In resolveFlags()
const shopTier = shop.subscriptionTier;
const tierLevel = { free: 0, pro: 1, enterprise: 2 };

for (const def of definitions) {
  if (tierLevel[shopTier] < tierLevel[def.subscriptionTier]) {
    featureFlags[def.key] = false;  // Force disabled regardless of toggle
    continue;
  }
  const override = overrides.find(o => o.featureKey === def.key);
  featureFlags[def.key] = override ? override.enabled : def.defaultEnabled;
}
```

## 9. Migration

```sql
-- 20260624000001_feature_flags.sql

CREATE TABLE feature_definitions ( ... );
CREATE TABLE shop_features ( ... );
CREATE INDEX idx_shop_features_shop_id ON shop_features(shop_id);
CREATE INDEX idx_shop_features_feature_key ON shop_features(feature_key);
CREATE INDEX idx_feature_definitions_category ON feature_definitions(category);
ALTER TABLE feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_features ENABLE ROW LEVEL SECURITY;
-- RLS policies ...
-- Seed data INSERT ...
```

## 10. Implementation Phases

| Phase | Scope | Effort |
|---|---|---|
| 1 | Migration: tables, indexes, RLS, seed data | 30 min |
| 2 | Service layer: `featureDefinitionsService`, `shopFeaturesService` | 1 hour |
| 3 | State: `featureFlags` in AppState, resolve on load | 30 min |
| 4 | Hook: `useFeatureFlag()`, `useFeatureFlags()` | 15 min |
| 5 | Component guards: wrap existing features with flag checks | 2 hours |
| 6 | Admin UI: `FeatureFlagsManager` component | 2 hours |

**Total: ~6 hours**

---

## Related Documents

- [Multi-Tenancy](multi-tenancy.md) — shop_id foundation that this builds on
- [Dynamic Shop Configuration](dynamic-shop-configuration.md) — shops table, subscription_tier column
- [PRD](prd.md) — feature requirements that flags control
