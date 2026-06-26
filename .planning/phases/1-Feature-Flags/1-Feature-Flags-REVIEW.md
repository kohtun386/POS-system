# Phase 1 — Feature Flags Code Review

**Reviewed:** 2026-06-26
**Scope:** 10 files changed (589 additions, 41 deletions across commit `4b99213`)
**Methodology:** Static analysis of Phase 1 commit + diff against spec `docs/specs/feature-flags.md`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 1 | Needs fix |
| 🟡 Warning | 3 | Needs fix |
| 🔵 Info | 2 | Optional |

---

## 🔴 Critical Findings

### C-1: `FeatureFlagsManager` uses hardcoded feature list instead of DB — defeats dynamic feature system

**File:** `src/components/settings/FeatureFlagsManager.tsx:17-31`

The component declares a **hardcoded** `features` array of 13 entries:

```typescript
const features = [
  { key: 'inventory_tracking', name: 'Inventory Tracking', category: 'inventory' },
  { key: 'batch_tracking', name: 'Batch Tracking', category: 'inventory' },
  // ... 11 more
];
```

The spec (`docs/specs/feature-flags.md §7.3`) says:
> "Toggle calls `shopFeaturesService.setFeature(shopId, key, enabled)`"
> "Table grouped by category (POS, Inventory, Kitchen, Customers, General)"

The **entire point** of `feature_definitions` is that features are database-driven. A platform admin should be able to add a new feature via SQL without touching frontend code. This hardcoded list means:
- Adding a 14th feature requires a code change + redeploy
- Name/category mismatches between DB and frontend are silent
- The `description` column from `feature_definitions` is never shown

**Fix:** Replace hardcoded `features` with `featureDefinitionsService.getAll()` loaded in a `useEffect`. Use `useState` for the definitions list. The component should also show `description` from the DB.

---

## 🟡 Warning Findings

### W-1: Missing "Reset to defaults" button — spec requirement not implemented

**File:** `src/components/settings/FeatureFlagsManager.tsx`

The spec (`docs/specs/feature-flags.md §7.3`) explicitly requires:
> "'Reset to defaults' button deletes all overrides for the shop"

The component has no reset button. `shopFeaturesService.deleteFeature()` exists in the service layer but is never called from the UI. An admin who toggles flags experimentally has no way to revert to defaults without direct DB access.

**Fix:** Add a "Reset to Defaults" button that iterates all 13 feature keys and calls `shopFeaturesService.deleteFeature(shopId, key)` for each, then dispatches `SET_FEATURE_FLAGS` with default values from `featureDefinitionsService`.

### W-2: `FeatureFlagsManager` bypasses reducer — UI and state can desync

**File:** `src/components/settings/FeatureFlagsManager.tsx:33-37`

```typescript
const handleToggle = async (key: string) => {
  const newValue = !featureFlags[key];
  dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: { key, enabled: newValue } });
  await shopFeaturesService.setFeature(state.activeShopId, key, newValue);
};
```

The reducer is dispatched **before** the async DB call. If `setFeature` fails (network error, RLS rejection), the UI shows the new state but the DB still has the old value. On next page refresh, the flag reverts — silent data loss.

**Fix:** Wrap in try/catch. On failure, dispatch `TOGGLE_FEATURE_FLAG` again to revert the optimistic update, and show an error toast.

### W-3: No loading or error states in `FeatureFlagsManager`

**File:** `src/components/settings/FeatureFlagsManager.tsx`

The component renders immediately with no loading indicator while feature definitions load from the DB (once C-1 fix is applied). No error boundary or error state if the DB call fails. The `handleToggle` has no error feedback.

**Fix:** Add `useState` for loading/error. Show a spinner during initial load. Show error toast on toggle failure (part of W-2 fix).

---

## 🔵 Info Findings

### I-1: `FeatureFlagsManager` missing `description` display

**File:** `src/components/settings/FeatureFlagsManager.tsx:49-64`

The spec says each row should show the feature name, description, and current state. The implementation only shows `feature.name`. The `description` column from `feature_definitions` is ignored. Users/admins have no context for what each feature does.

**Fix:** Show `description` below the feature name once C-1 fix loads definitions from DB.

### I-2: Unused migration `20260624000002_recipe_bom.sql` in Phase 1 commit

**File:** `supabase/migrations/20260624000002_recipe_bom.sql`

The Phase 1 commit (`4b99213`) includes the Recipe BOM migration file (184 lines). This is a Phase 2 artifact that leaked into the Phase 1 commit. Not a functional issue — the migration is idempotent and runs sequentially — but it violates atomic commit boundaries and makes rollback harder.

**Fix:** None needed — already committed. Note for future: keep migrations scoped to their phase.

---

## Phase 1 Requirements Alignment

| Task | Requirement | Status | Notes |
|------|-------------|--------|-------|
| 1.1 | Migration: `feature_definitions` + `shop_features` tables | ✅ PASS | Matches spec exactly: 2 tables, 3 indexes, 2 RLS policies per table, 13 seed rows |
| 1.2 | Service layer: `featureDefinitionsService` + `shopFeaturesService` | ✅ PASS | `getAll()`, `getByShopId()`, `setFeature()`, `deleteFeature()` all present |
| 1.3 | State: `featureFlags` in AppState + resolve on load | ✅ PASS | Resolves after shop loads (C-2 fix from Phase 0 review applied) |
| 1.4 | Hooks: `useFeatureFlag()` + `useFeatureFlags()` | ✅ PASS | Clean implementation, matches spec §7.1 exactly |
| 1.5 | Component guards: Header, App, CheckoutModal | ✅ PASS | `inventory_tracking`, `customer_management`, `discount_engine`, `kitchen_display`, `credit_system` all gated |
| 1.6 | Admin UI: `FeatureFlagsManager` component | ⚠ PARTIAL | Toggle works. Missing: DB-driven features, reset button, error handling |

**Overall requirement alignment:** 5/6 PASS, 1 PARTIAL

---

## RLS Verification

| Table | Policy | Spec | Implementation | Match |
|-------|--------|------|----------------|-------|
| `feature_definitions` | SELECT: all authenticated | `auth.role() = 'authenticated'` | `auth.role() = 'authenticated'` | ✅ |
| `feature_definitions` | ALL: admin only | `users.role = 'admin'` | `users.role = 'admin'` | ✅ |
| `shop_features` | SELECT: shop members | `shop_id IN (SELECT current_shop_ids())` | `shop_id IN (SELECT public.current_shop_ids())` | ✅ |
| `shop_features` | ALL: shop admin | `shop_memberships.role = 'admin'` | `shop_memberships.role = 'admin'` | ✅ |

---

## Verdict

**⚠ Safe to merge after fixing C-1 and W-1+W-2.** C-1 is the most impactful — without it, the admin UI is a mock that doesn't reflect the actual DB-driven feature system. W-1+W-2 are correctness issues (missing reset + silent data loss on network failure).

W-3 and I-1 are polish items that naturally resolve when C-1 is fixed (loading states come with async DB fetch, descriptions come with DB-driven features).

**Recommendation:** Fix C-1, W-1, W-2 before merging. W-3 and I-1 are optional improvements.
