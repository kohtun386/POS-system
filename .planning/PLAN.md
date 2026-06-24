# Implementation Plan — Feature Flags, Recipe BOM, Kitchen KDS

**Date:** 2026-06-24
**Status:** Ready for execution
**Estimated total:** 6-8 days across 4 phases

---

## Sequencing Rationale

Three hard blocks from CONCERNS.md dictate the order:

1. **Feature Flags** depends on `state.shop` existing (CONCERNS #23 — multi-tenancy not wired). Without an active shop ID in state, `shop_features` queries have no scope. The dynamic-shop-configuration spec already defines `state.shop`, `shopsService`, and the `loadData()` changes. We execute a **minimal slice** of that spec first — just enough to get `state.shop` populated.

2. **Recipe BOM** depends on reconciling the checkout inventory update (CONCERNS #1). The current app-level stock loop and the new DB trigger would double-deduct. We must migrate `products.stock` deduction into the trigger alongside raw materials.

3. **Kitchen KDS** depends on an ErrorBoundary (CONCERNS #4). A white-screened kitchen display is a production emergency. The boundary is cheap to add and protects all downstream features.

4. **Quick wins** (settings role guard, dead code cleanup) are bundled into Phase 0 since they're < 1 hour total and reduce risk surface.

---

## Phase 0 — Prerequisites & Quick Wins

**Goal:** Unblock all three systems. Fix critical concerns. Zero feature changes.
**Effort:** 2-3 hours
**Specs:** `docs/specs/dynamic-shop-configuration.md` (minimal slice), `docs/specs/feature-flags.md` (none yet)

### Tasks

#### 0.1 — Settings Role Guard (CONCERNS #2)
- **File:** `src/App.tsx` line 93
- **Change:** Add `userRole !== 'cashier'` check before rendering `<Settings />`
- **Verify:** Cashier logged in → redirected to POS, not settings

#### 0.2 — Add ErrorBoundary (CONCERNS #4)
- **Files:** New `src/components/ui/ErrorBoundary.tsx`, `src/App.tsx`
- **Change:** Class component with `componentDidCatch` + fallback UI. Wrap `<AppContent />` in `App.tsx`. Wrap KDS view specifically in Phase 3.
- **Verify:** Throw test error in a component → fallback UI renders, not white screen

#### 0.3 — Add `Shop` Type + `shopsService` (Dynamic Shop Config §2.5)
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add `Shop` interface. Create `shopsService.getByUserId(userId)` that queries `shop_memberships` → `shops`. Create `mapShopRow()`.
- **Verify:** TypeScript compiles. `shopsService.getByUserId()` returns shop for default user.

#### 0.4 — Add `state.shop` + `SET_SHOP` Action
- **File:** `src/context/SupabaseAppContext.tsx`
- **Change:** Add `shop: Shop` to `AppState`. Add `SET_SHOP` action + reducer case. Set `initialState.shop` with defaults. Update `loadData()` to call `shopsService.getByUserId(user.id)` in the `Promise.all`.
- **Verify:** App loads → `state.shop` populated with default shop data. `state.shop.id` is set.

#### 0.5 — Delete Dead Code (CONCERNS #8, #9, #10)
- **Files:** Delete `src/context/AppContext.tsx`, `src/components/examples/CurrencyExample.tsx`. Remove `react-router-dom`, `@supabase/auth-ui-react`, `@supabase/auth-ui-shared` from `package.json`.
- **Verify:** `npm run lint` passes. App still loads.

#### 0.6 — Create `shopMembershipsService` (CONCERNS #11)
- **Files:** `src/lib/services.ts`, `src/context/SupabaseAppContext.tsx`
- **Change:** Create `shopMembershipsService` with `getByUserId()`. Replace direct `supabase.from('shop_memberships')` call in `loadData()`.
- **Verify:** No direct `supabase.from()` calls outside services.

**Phase 0 exit criteria:**
- `state.shop` exists and is populated on login
- `state.shop.id` available for feature flag resolution
- ErrorBoundary wraps app content
- Settings role-guarded
- Dead code removed
- `npm run lint` passes

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

---

## Phase 2 — Recipe BOM + Checkout Reconciliation

**Goal:** Raw materials, recipes, consumption tracking. Atomic stock deduction on sale.
**Effort:** ~2 days
**Spec:** `docs/specs/recipe-bom.md`
**Blocked by:** Phase 0 (state.shop), Phase 1 (feature flag: `inventory_tracking`)

### Tasks

#### 2.1 — Migration: `raw_materials`, `recipes`, `recipe_lines`, `consumption_log`, `uom_conversions`
- **File:** `supabase/migrations/20260624000002_recipe_bom.sql`
- **Change:** All 5 tables with `shop_id`, indexes, RLS policies matching spec. Seed `uom_conversions` with 13 common conversions.
- **Verify:** `supabase db push` succeeds. Tables visible. RLS enforced.

#### 2.2 — Migration: Atomic Deduction Trigger (reconcile with existing checkout)
- **File:** `supabase/migrations/20260624000003_deduction_trigger.sql`
- **Change:** Create `deduct_raw_materials()` trigger on `AFTER INSERT ON sales`. The trigger:
  1. Loops through `NEW.items` JSONB array
  2. For each item with a recipe: deducts `raw_materials.current_stock`
  3. Logs to `consumption_log`
  4. **Also updates `products.stock`** (replaces the app-level loop)
  5. `RAISE EXCEPTION` on insufficient stock → rolls back entire sale
- **Critical reconciliation:** The existing app-level stock update loop in `CheckoutModal.tsx` (lines 345-364) must be **removed** once the trigger handles `products.stock`. Both paths must not coexist.
- **Verify:** Insert a test sale → `raw_materials.current_stock` decremented, `products.stock` decremented, `consumption_log` row created. Insert sale with insufficient stock → entire transaction rolls back, no partial deductions.

#### 2.3 — Pre-Checkout Stock Validation
- **Files:** `src/lib/inventoryUtils.ts` (new or modify), `src/components/pos/CheckoutModal.tsx`
- **Change:** `checkStockAvailability(cartItems, shopId)` queries recipes + raw materials, returns `StockCheckResult`. Called in `CheckoutModal` before `salesService.create()`. Show error modal if insufficient.
- **Verify:** Add item to cart with insufficient raw material stock → checkout blocked with clear error message.

#### 2.4 — Remove App-Level Stock Update from Checkout
- **File:** `src/components/pos/CheckoutModal.tsx` (lines 345-364)
- **Change:** Remove the `for (const item of state.cart)` loop that calls `productsService.update()`. The trigger now handles this atomically. Keep the `dispatch({ type: 'ADD_SALE' })` and customer stats update.
- **Verify:** Checkout completes → `products.stock` still decremented (by trigger). No double deduction. `npm run lint` passes.

#### 2.5 — Service Layer: Raw Materials, Recipes, Recipe Lines, Consumption Log
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add types for `RawMaterial`, `Recipe`, `RecipeLine`, `ConsumptionLog`, `UomConversion`. Add 4 service objects with full CRUD. Add `UomConverter` class in `src/lib/uomUtils.ts`.
- **Verify:** TypeScript compiles. Services return data.

#### 2.6 — State: Add Recipe/BOM State to Reducer
- **File:** `src/context/SupabaseAppContext.tsx`
- **Change:** Add `rawMaterials`, `recipes` to `AppState`. Add `ADD_RAW_MATERIAL`, `UPDATE_RAW_MATERIAL`, `DELETE_RAW_MATERIAL`, `ADD_RECIPE`, `UPDATE_RECIPE`, `DELETE_RECIPE` actions. Load in `loadData()`.
- **Verify:** App loads → state populated with raw materials and recipes.

#### 2.7 — UI: `RawMaterialManager` Component
- **Files:** New `src/components/inventory/RawMaterialManager.tsx`, `src/components/inventory/RawMaterialModal.tsx`
- **Change:** Manager (table with search, category filter, low-stock alerts, restock action) + Modal (create/edit form with UoM selection). Gated by `inventory_tracking` feature flag.
- **Verify:** Admin can CRUD raw materials. Restock updates `current_stock`.

#### 2.8 — UI: `RecipeManager` + `RecipeForm` Components
- **Files:** New `src/components/recipes/RecipeManager.tsx`, `src/components/recipes/RecipeForm.tsx`
- **Change:** Manager (list of products with recipe status, search). Form (product selector, recipe lines with material/quantity/UoM/wastage, auto-computed `theoreticalCost`). Gated by `inventory_tracking` feature flag.
- **Verify:** Admin can create recipe for a product. `theoreticalCost` computed correctly. Recipe lines save with UoM conversion to base unit.

#### 2.9 — UI: Consumption Report
- **Files:** New `src/components/reports/ConsumptionReport.tsx`
- **Change:** Table showing consumption log with filters (date range, material, product). Summary stats: total cost, by material, wastage totals. Gated by `inventory_tracking` feature flag.
- **Verify:** Report shows consumption data from completed sales.

**Phase 2 exit criteria:**
- 5 new tables with RLS
- Atomic trigger deducts raw materials + product stock on sale
- No double deduction (app-level loop removed)
- Pre-checkout stock validation blocks insufficient sales
- Consumption log immutable (trigger-only writes)
- UoM conversion at recipe authoring time
- Admin can manage raw materials and recipes
- Feature flag `inventory_tracking` gates all BOM UI
- `npm run lint` passes

---

## Phase 3 — Kitchen KDS

**Goal:** Real-time kitchen display. Order lifecycle tracking. Print job queue.
**Effort:** ~2 days
**Spec:** `docs/specs/kitchen-workflow.md`
**Blocked by:** Phase 0 (ErrorBoundary), Phase 1 (feature flag: `kitchen_display`)

### Tasks

#### 3.1 — Migration: `kitchen_orders` + `print_jobs` Tables
- **File:** `supabase/migrations/20260624000004_kitchen_workflow.sql`
- **Change:** Both tables with `shop_id`, indexes, RLS policies:
  - `kitchen_orders`: SELECT all authenticated, INSERT all authenticated, UPDATE status all authenticated, DELETE admin/manager
  - `print_jobs`: Service-layer access only (no direct user policies)
- **Verify:** `supabase db push` succeeds. Tables visible.

#### 3.2 — Service Layer: `kitchenOrdersService` + `printJobsService`
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add `KitchenOrder`, `PrintJob` types. Add both service objects with full CRUD + status transitions.
- **Verify:** TypeScript compiles. Services return data.

#### 3.3 — Realtime Hook: `useRealtimeSubscription`
- **Files:** New `src/hooks/useRealtimeSubscription.ts`
- **Change:** Generic Supabase Realtime hook. Subscribes to `postgres_changes` on a table filtered by `shop_id`. Returns live data with INSERT/UPDATE/DELETE handlers. Auto-reconnect on disconnect. 10s polling fallback.
- **Verify:** Insert a row in `kitchen_orders` via SQL → hook receives the event.

#### 3.4 — Checkout Integration: Create Kitchen Orders on Sale
- **Files:** `src/components/pos/CheckoutModal.tsx`, `src/lib/kitchenUtils.ts` (new)
- **Change:** After sale is created, for each eligible item (where `requiresPreparation !== false`): call `kitchenOrdersService.create()`. If printer configured, call `printJobsService.enqueue()`. Station assignment via `determineStation()` from `kitchenUtils.ts`. Gated by `kitchen_display` feature flag.
- **Verify:** Complete a sale → `kitchen_orders` rows created for eligible items. `print_jobs` rows created if printer enabled.

#### 3.5 — KDS UI: `KitchenDisplay` Component
- **Files:** New `src/components/kitchen/KitchenDisplay.tsx`, `src/components/kitchen/KitchenOrderCard.tsx`
- **Change:** Kanban layout with 3 columns (Pending, In Progress, Ready). Uses `useRealtimeSubscription` for live updates. Color-coded cards with elapsed timer. Touch-friendly (48px+ targets). Keyboard shortcuts (Enter/Space to advance, Escape to cancel). Station filter tabs. Audio alert on new order. Wrapped in ErrorBoundary.
- **Verify:** Sale completed → order appears on KDS instantly. Tap "Start" → moves to In Progress. Tap "Ready" → moves to Ready. Timer counts up.

#### 3.6 — KDS Status Flow Integration
- **Files:** `src/components/kitchen/KitchenDisplay.tsx`
- **Change:** Full 5-state flow: pending → in_progress → ready → picked_up → cancelled. Timestamps recorded at each transition (`started_at`, `completed_at`, `picked_up_at`). Cancel requires admin/manager role.
- **Verify:** Complete order lifecycle. Timestamps recorded correctly. Cashier can't cancel.

#### 3.7 — KDS Analytics: `KitchenStats` Component
- **Files:** New `src/components/kitchen/KitchenStats.tsx`
- **Change:** Dashboard with: average prep time, orders per hour, on-time %, cancellation rate, per-station load, busiest hours. Date range filter. Gated by `kitchen_display` feature flag.
- **Verify:** Stats computed from `kitchen_orders` data. Matches manual calculation.

#### 3.8 — KDS Settings: Printer Configuration
- **Files:** New `src/components/kitchen/KitchenSettings.tsx`
- **Change:** Enable/disable kitchen printer. Set printer ID. Station assignment config. Admin-only access.
- **Verify:** Toggle printer off → no `print_jobs` created on checkout. Toggle on → jobs created.

#### 3.9 — Navigation: Add KDS to Header
- **Files:** `src/components/layout/Header.tsx`, `src/App.tsx`
- **Change:** Add "Kitchen" nav item gated by `kitchen_display` feature flag. Add `KitchenDisplay` to `renderCurrentView()`.
- **Verify:** Flag on → KDS nav visible. Flag off → hidden. Cashier can access KDS.

**Phase 3 exit criteria:**
- 2 new tables with RLS
- Real-time KDS with Supabase Realtime WebSocket
- 5-state order lifecycle with timestamps
- Station routing (bar, espresso, food, pastry)
- Print job queue with retry
- KDS analytics dashboard
- Printer configuration UI
- ErrorBoundary wraps KDS
- Feature flag `kitchen_display` gates all KDS UI
- `npm run lint` passes

---

## Dependency Graph

```
Phase 0 (Prerequisites)
  ├── 0.1 Settings role guard
  ├── 0.2 ErrorBoundary
  ├── 0.3 Shop type + shopsService
  ├── 0.4 state.shop + SET_SHOP       ──┐
  ├── 0.5 Dead code cleanup             │
  └── 0.6 shopMembershipsService        │
                                        │
Phase 1 (Feature Flags) ◄──────────────┘
  ├── 1.1 Migration (2 tables + seed)
  ├── 1.2 Services
  ├── 1.3 State + resolve on load
  ├── 1.4 Hooks
  ├── 1.5 Component guards
  └── 1.6 Admin UI
        │
        ├──► Phase 2 (Recipe BOM) ◄── requires inventory_tracking flag
        │     ├── 2.1 Migration (5 tables)
        │     ├── 2.2 Atomic trigger (reconcile checkout)
        │     ├── 2.3 Pre-checkout validation
        │     ├── 2.4 Remove app-level stock loop
        │     ├── 2.5 Services + UoM
        │     ├── 2.6 State
        │     ├── 2.7 RawMaterialManager
        │     ├── 2.8 RecipeManager
        │     └── 2.9 ConsumptionReport
        │
        └──► Phase 3 (Kitchen KDS) ◄── requires kitchen_display flag
              ├── 3.1 Migration (2 tables)
              ├── 3.2 Services
              ├── 3.3 Realtime hook
              ├── 3.4 Checkout integration
              ├── 3.5 KDS UI
              ├── 3.6 Status flow
              ├── 3.7 Analytics
              ├── 3.8 Settings
              └── 3.9 Navigation
```

**Phase 2 and Phase 3 are independent** — they can be developed in parallel after Phase 1 completes.

---

## Risk Register

| Risk | Phase | Mitigation |
|------|-------|------------|
| Trigger migration breaks existing checkout | 2 | Test with a sale INSERT before removing app-level loop. Rollback plan: drop trigger, restore loop. |
| Realtime connection drops in kitchen | 3 | 10s polling fallback built into `useRealtimeSubscription`. |
| Feature flag resolution slow on login | 1 | Two queries (definitions + overrides), cached in state. Only runs once per session. |
| UoM conversion edge cases | 2 | Unit tests for `UomConverter`. Seed comprehensive conversion table. |
| RLS policy mismatch on new tables | 1, 2, 3 | Follow exact pattern from existing 18 tables. Test with each role. |

---

## Files Summary

### New files to create (17)
| File | Phase |
|------|-------|
| `src/components/ui/ErrorBoundary.tsx` | 0 |
| `src/hooks/useFeatureFlag.ts` | 1 |
| `src/components/settings/FeatureFlagsManager.tsx` | 1 |
| `src/lib/uomUtils.ts` | 2 |
| `src/lib/inventoryUtils.ts` | 2 |
| `src/components/inventory/RawMaterialManager.tsx` | 2 |
| `src/components/inventory/RawMaterialModal.tsx` | 2 |
| `src/components/recipes/RecipeManager.tsx` | 2 |
| `src/components/recipes/RecipeForm.tsx` | 2 |
| `src/components/reports/ConsumptionReport.tsx` | 2 |
| `src/hooks/useRealtimeSubscription.ts` | 3 |
| `src/lib/kitchenUtils.ts` | 3 |
| `src/components/kitchen/KitchenDisplay.tsx` | 3 |
| `src/components/kitchen/KitchenOrderCard.tsx` | 3 |
| `src/components/kitchen/KitchenStats.tsx` | 3 |
| `src/components/kitchen/KitchenSettings.tsx` | 3 |
| `src/lib/printService.ts` | 3 |

### Existing files to modify (12)
| File | Phase | Change |
|------|-------|--------|
| `src/App.tsx` | 0, 1, 3 | ErrorBoundary, feature guards, KDS route |
| `src/types/index.ts` | 0, 1, 2, 3 | Shop, FeatureDefinition, RawMaterial, Recipe, KitchenOrder types |
| `src/lib/services.ts` | 0, 1, 2, 3 | shopsService, featureServices, recipeServices, kitchenServices |
| `src/context/SupabaseAppContext.tsx` | 0, 1, 2 | state.shop, featureFlags, rawMaterials, recipes |
| `src/components/layout/Header.tsx` | 1, 3 | Feature-gated nav items, KDS nav |
| `src/components/pos/CheckoutModal.tsx` | 2, 3 | Remove stock loop, add kitchen order creation |
| `src/components/inventory/InventoryManager.tsx` | 1 | Feature flag guard |
| `src/components/customers/CustomerManager.tsx` | 1 | Feature flag guard |
| `src/components/discounts/DiscountManager.tsx` | 1 | Feature flag guard |
| `package.json` | 0 | Remove unused deps |
| `src/context/AppContext.tsx` | 0 | DELETE (dead code) |
| `src/components/examples/CurrencyExample.tsx` | 0 | DELETE (dead code) |

### Migrations to create (4)
| Migration | Phase | Tables |
|-----------|-------|--------|
| `20260624000001_feature_flags.sql` | 1 | feature_definitions, shop_features |
| `20260624000002_recipe_bom.sql` | 2 | raw_materials, recipes, recipe_lines, consumption_log, uom_conversions |
| `20260624000003_deduction_trigger.sql` | 2 | deduct_raw_materials() trigger |
| `20260624000004_kitchen_workflow.sql` | 3 | kitchen_orders, print_jobs |

---

## Execution Notes

- **Lint after every phase:** `npm run lint` must pass before moving to next phase
- **Manual verification:** Each phase has specific verification steps — do not skip
- **Feature flags first:** Phases 2 and 3 consume flags from Phase 1. Never implement a feature without its flag gate.
- **Trigger before UI:** Phase 2.2 (trigger) must complete before Phase 2.4 (remove app loop). Never have both paths active.
- **ErrorBoundary before KDS:** Phase 0.2 must complete before Phase 3.5
