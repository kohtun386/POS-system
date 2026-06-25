---
phase: 1
name: Feature Flags
status: pending
goal: Per-shop feature toggling. Gating infrastructure for KDS and all future features.
effort: ~6 hours
req_ids:
  - FF-01
  - FF-02
  - FF-03
  - FF-04
  - FF-05
  - FF-06
---

## Phase 1 — Feature Flags

**Goal:** Per-shop feature toggling. Gating infrastructure for KDS and all future features.
**Effort:** ~6 hours
**Spec:** `docs/specs/feature-flags.md`

### Tasks

#### 1.1 — Migration: `feature_definitions` + `shop_features` Tables
- **File:** `supabase/migrations/20260624000001_feature_flags.sql`
- **Change:** Create `feature_definitions` (with seed data for 13 features), `shop_features` (UNIQUE shop_id + feature_key), indexes, RLS policies:
  - `feature_definitions`: SELECT all authenticated, ALL admin only
  - `shop_features`: SELECT via `current_shop_ids()`, ALL via shop admin in `shop_memberships`
- **Verify:** `supabase db push` succeeds. Tables visible in dashboard. Seed data present. RLS enforced.

#### 1.2 — Service Layer: `featureDefinitionsService` + `shopFeaturesService`
- **Files:** `src/types/index.ts` (add `FeatureDefinition`, `ShopFeature`, `FeatureFlags`), `src/lib/services.ts`
- **Change:** `featureDefinitionsService.getAll()`. `shopFeaturesService.getByShopId()`, `.setFeature()` (UPSERT), `.deleteFeature()` (revert to default).
- **Verify:** TypeScript compiles. Services return data.

#### 1.3 — State: `featureFlags` in AppState + Resolve on Load
- **File:** `src/context/SupabaseAppContext.tsx`
- **Change:** Add `featureFlags: FeatureFlags` to `AppState`. Add `SET_FEATURE_FLAGS` + `TOGGLE_FEATURE_FLAG` actions. In `loadData()`, after shop loads, resolve flags: for each definition, check override → else use default. Dispatch `SET_FEATURE_FLAGS`.
- **Verify:** App loads → `state.featureFlags` has 13 entries. `kitchen_display` is `false` by default.

#### 1.4 — Hooks: `useFeatureFlag()` + `useFeatureFlags()`
- **Files:** New `src/hooks/useFeatureFlag.ts`
- **Change:** `useFeatureFlag(key)` returns boolean. `useFeatureFlags()` returns full record.
- **Verify:** Hook returns correct value in a test component.

#### 1.5 — Component Guards: Wrap Existing Features
- **Files:** `src/components/layout/Header.tsx`, `src/App.tsx` (renderCurrentView), `src/components/pos/CheckoutModal.tsx`, `src/components/inventory/InventoryManager.tsx`, `src/components/customers/CustomerManager.tsx`, `src/components/discounts/DiscountManager.tsx`
- **Change:** Add `useFeatureFlag()` checks:
  - `kitchen_display` → KDS nav item (Phase 3 will add the view)
  - `inventory_tracking` → InventoryManager guard
  - `customer_management` → CustomerManager guard
  - `credit_system` → Credit payment button in checkout
  - `discount_engine` → DiscountManager nav
  - `multi_currency` → Currency selector in settings
  - `draft_sales` → Draft button in checkout
  - `multi_tab_sales` → SalesTabs component
- **Verify:** Toggle `inventory_tracking` off in DB → Inventory nav item disappears. Toggle back on → reappears.

#### 1.6 — Admin UI: `FeatureFlagsManager` Component
- **Files:** New `src/components/settings/FeatureFlagsManager.tsx`, `src/App.tsx`, `src/components/layout/Header.tsx`
- **Change:** Table grouped by category. Toggle per feature. "Reset to defaults" button. Admin-only nav item.
- **Verify:** Admin sees feature flags page. Toggle `kitchen_display` on → flag resolves to `true` in state.

**Phase 1 exit criteria:**
- 13 feature definitions seeded
- Per-shop overrides via UPSERT
- Flags resolved at login into `state.featureFlags`
- Existing features gated by flags
- Admin can toggle flags
- RLS: shop members read, shop admin writes