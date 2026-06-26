# Phase 0 — Prerequisites & Quick Wins Code Review

**Reviewed:** 2026-06-26
**Scope:** 10 files changed (2 deleted, 1 created, 7 modified)
**Methodology:** Static analysis of Phase 0 commit `eb4b53e`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 2 | ✅ Fixed |
| 🟡 Warning | 2 | ✅ Fixed |
| 🔵 Info | 1 | Deferred |

---

## 🔴 Critical Findings

### C-1: Duplicate interface definitions in `src/types/index.ts` — COMPILE ERROR

**File:** `src/types/index.ts:354-399`

Three types are defined twice with identical signatures:

```typescript
// Lines 354-374
export interface FeatureDefinition { ... }
export interface ShopFeature { ... }
export type FeatureFlags = Record<string, boolean>;

// Lines 380-399 (DUPLICATE — exact same definitions)
export interface FeatureDefinition { ... }
export interface ShopFeature { ... }
export type FeatureFlags = Record<string, boolean>;
```

**Impact:** `tsc --noEmit` produces `Duplicate identifier 'FeatureDefinition'` errors. Build fails.

**Fix:** Remove lines 376-399 (the second block). The comment header `// ================================================================ // Feature Flags` at line 376 is a copy-paste artifact from merging Phase 1 types into the file without cleaning up the existing Phase 1 block already at line 354.

### C-2: `shopFeatures` never loaded — all feature flag overrides silently default

**File:** `src/context/SupabaseAppContext.tsx:406-407`

```typescript
const [ ..., shop, featureDefinitions, shopFeatures, ... ] = await Promise.all([ ... ]);

// The problem: shop is undefined when the array is constructed
user ? shopMembershipsService.getShopByUserId(user.id) : Promise.resolve(null),
featureDefinitionsService.getAll(),
shop ? shopFeaturesService.getByShopId(shop.id) : Promise.resolve([]),  // NEVER calls getByShopId
```

`Promise.all` evaluates its array eagerly. Variable `shop` is assigned from destructured results — at array-construction time `shop` is `undefined`, so the ternary always falls through to `Promise.resolve([])`.

**Impact:** Every shop-level feature override in `shop_features` DB table is silently ignored. All 13 feature flags resolve to their `defaultEnabled` value. An admin who toggles `kitchen_display` ON in the FeatureFlagsManager UI will see it toggle locally in state, but on next page refresh the flag reverts to `false` (the default).

**Fix (two options):**

Option A — Split into two sequential loads:
```typescript
// Load shop first
const shop = await shopMembershipsService.getShopByUserId(user.id);
// Then load shop features
const shopFeatures = shop ? await shopFeaturesService.getByShopId(shop.id) : [];
```

Option B — Extract shop resolution into a helper that gets called after shop is available:
```typescript
const loadShopFeatures = async (shop: Shop | null) => {
  return shop ? shopFeaturesService.getByShopId(shop.id) : [];
};

// In Promise.all:
const [ ..., shop, featureDefinitions ] = await Promise.all([ ... ]);
const shopFeatures = await loadShopFeatures(shop);
```

---

## 🟡 Warning Findings

### W-1: Unused import `AppliedDiscount` in SupabaseAppContext

**File:** `src/context/SupabaseAppContext.tsx:3`

`AppliedDiscount` is imported but never referenced directly in this file. The type is part of `Sale` interface (defined in `types/index.ts`) and accessed via `sale.appliedDiscounts`, but the import is not needed — TypeScript resolves nested types through the `Sale` import.

**Fix:** Remove `AppliedDiscount` from the import.

### W-2: `any` type usage in services — missing type safety

**File:** `src/lib/services.ts` — multiple locations spanning all service objects

The service layer uses pervasive `as any` casts for JSONB fields (`items`, `payments`, `conditions`, `config_data`) and for DB row mapping. Key examples:

- Line 77: `.map((batch: any) => ({`
- Lines 372-386: `sale.items as any[]`, `sale.payment_method as any`
- Line 1320: `.map((row: any) => ({`
- Lines 1960-1974: `.map((row: any) => ({`
- All RawMaterial/Recipe/ConsumptionLog/KDS service methods use `(row: any)`

**Impact:** No compile-time checking for DB column mapping errors. A renamed column or incorrect camelCase mapping will silently produce `undefined` at runtime.

**Fix:** Create a `DatabaseRow` mapped type or use Supabase's generated types. At minimum, add mapped return types for internal helper functions. This is a pre-existing debt (affects ALL phases, not just Phase 0) — consider a codebase-wide typed-row migration.

---

## 🔵 Info Findings

### I-1: Phase 0 plan requires `mapShopRow()` but none exists

**File:** `src/lib/services.ts` — `shopsService` (line 1307)

Phase 0 plan Task 0.3 says:
> Create `mapShopRow()`.

The shopsService inline-maps the row in each method instead. This is functionally equivalent and 6 lines shorter, but means `Shop` mapping is duplicated across `shopsService.getById()` (lines 1297-1305) and `shopMembershipsService.getShopByUserId()` (lines 1274-1281).

**Fix:** Extract a shared `mapShopRow(data: any): Shop` function. Deferred — not blocking.

---

## Phase 0 Requirements Alignment

| Task | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 0.1 | Settings role guard (`userRole !== 'cashier'`) | ✅ PASS | Admin/manager allowed, cashier redirected to POS |
| 0.2 | ErrorBoundary class component + wrap AppContent | ✅ PASS | Class component with `componentDidCatch` + retry button |
| 0.3 | Shop type + shopsService with getByUserId | ✅ PASS | `mapShopRow()` inlined — acceptable deviation |
| 0.4 | state.shop + SET_SHOP in reducer + loadData | ✅ PASS | Shop loaded in Promise.all, dispatched to state |
| 0.5 | Delete dead code (AppContext, CurrencyExample, 3 deps) | ✅ PASS | Files confirmed deleted; deps removed from package.json |
| 0.6 | shopMembershipsService replaces direct supabase call | ✅ PASS | Used in loadData, no direct supabase.from in AppContext |

**Overall requirement alignment:** 6/6 PASS

---

## Verdict

**⚠ Safe to merge after fixing C-1 and C-2.** Both critical issues are isolated:
1. C-1: One block delete in `types/index.ts` (< 30 seconds)
2. C-2: One Promise.all restructuring in `SupabaseAppContext.tsx` (< 5 minutes)

W-1 and W-2 are pre-existing or minor. I-1 is optional cleanup.

Without C-1 fix: build fails (duplicate identifiers).
Without C-2 fix: feature flag overrides silently broken — admin toggles are lost on refresh.

**Recommendation:** Fix C-1 + C-2 before merging to `main`. W-1, W-2, I-1 can be deferred or fixed alongside Phase 1 review.
