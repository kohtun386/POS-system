---
phase: 2
name: Recipe BOM + Checkout Reconciliation
status: completed
goal: Raw materials, recipes, consumption tracking. Atomic stock deduction on sale.
effort: ~2 days
req_ids:
  - BOM-01
  - BOM-02
  - BOM-03
  - BOM-04
  - BOM-05
  - BOM-06
  - BOM-07
  - BOM-08
  - BOM-09
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

#### 2.2 — Migration: Atomic Deduction Trigger (reconcile with existing checkout) ✅
- **File:** `supabase/migrations/20260624000003_deduction_trigger.sql`
- **Change:** Create `deduct_raw_materials()` trigger on `AFTER INSERT ON sales`. The trigger:
  1. Loops through `NEW.items` JSONB array
  2. For each item with a recipe: deducts `raw_materials.current_stock`
  3. Logs to `consumption_log`
  4. **Also updates `products.stock`** (replaces the app-level loop)
  5. `RAISE EXCEPTION` on insufficient stock → rolls back entire sale
- **Critical reconciliation:** The existing app-level stock update loop in `CheckoutModal.tsx` (lines 345-364) must be **removed** once the trigger handles `products.stock`. Both paths must not coexist.
- **Verify:** Insert a test sale → `raw_materials.current_stock` decremented, `products.stock` decremented, `consumption_log` row created. Insert sale with insufficient stock → entire transaction rolls back, no partial deductions.

#### 2.3 — Pre-Checkout Stock Validation ✅
- **Files:** `src/lib/inventoryUtils.ts` (new or modify), `src/components/pos/CheckoutModal.tsx`
- **Change:** `checkStockAvailability(cartItems, shopId)` queries recipes + raw materials, returns `StockCheckResult`. Called in `CheckoutModal` before `salesService.create()`. Show error modal if insufficient.
- **Verify:** Add item to cart with insufficient raw material stock → checkout blocked with clear error message.

#### 2.4 — Remove App-Level Stock Update from Checkout ✅
- **File:** `src/components/pos/CheckoutModal.tsx` (lines 345-364)
- **Change:** Remove the `for (const item of state.cart)` loop that calls `productsService.update()`. The trigger now handles this atomically. Keep the `dispatch({ type: 'ADD_SALE' })` and customer stats update.
- **Verify:** Checkout completes → `products.stock` still decremented (by trigger). No double deduction. `npm run lint` passes.

#### 2.5 — Service Layer: Raw Materials, Recipes, Recipe Lines, Consumption Log ✅
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add types for `RawMaterial`, `Recipe`, `RecipeLine`, `ConsumptionLog`, `UomConversion`. Add 4 service objects with full CRUD. Add `UomConverter` class in `src/lib/uomUtils.ts`.
- **Verify:** TypeScript compiles. Services return data.

#### 2.6 — State: Add Recipe/BOM State to Reducer ✅
- **File:** `src/context/SupabaseAppContext.tsx`
- **Change:** Add `rawMaterials`, `recipes` to `AppState`. Add `ADD_RAW_MATERIAL`, `UPDATE_RAW_MATERIAL`, `DELETE_RAW_MATERIAL`, `ADD_RECIPE`, `UPDATE_RECIPE`, `DELETE_RECIPE` actions. Load in `loadData()`.
- **Verify:** App loads → state populated with raw materials and recipes.

#### 2.7 — UI: `RawMaterialManager` Component ✅
- **Files:** New `src/components/inventory/RawMaterialManager.tsx`, `src/components/inventory/RawMaterialModal.tsx`
- **Change:** Manager (table with search, category filter, low-stock alerts, restock action) + Modal (create/edit form with UoM selection). Gated by `inventory_tracking` feature flag.
- **Verify:** Admin can CRUD raw materials. Restock updates `current_stock`.

#### 2.8 — UI: `RecipeManager` + `RecipeForm` Components ✅
- **Files:** New `src/components/recipes/RecipeManager.tsx`, `src/components/recipes/RecipeForm.tsx`
- **Change:** Manager (list of products with recipe status, search). Form (product selector, recipe lines with material/quantity/UoM/wastage, auto-computed `theoreticalCost`). Gated by `inventory_tracking` feature flag.
- **Verify:** Admin can create recipe for a product. `theoreticalCost` computed correctly. Recipe lines save with UoM conversion to base unit.

#### 2.9 — UI: Consumption Report ✅
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