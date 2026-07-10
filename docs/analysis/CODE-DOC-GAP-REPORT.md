# Doc-to-Code Gap Report
**Date:** 2026-07-10
**Status:** READ-ONLY SCAN COMPLETE

## 🔴 Critical Gaps (Must Fix for v1.0)

| Area | Doc Requirement | Current Code State | File(s) | Fix Required |
|------|-----------------|--------------------|---------|--------------|
| *(none)* | — | — | — | Dead key cleanup is complete. Checkout uses RPC. Auth/role wiring is correct. |

## 🟡 Functional Gaps (Partially Implemented)

| Feature | Doc Status | Code Status | Notes |
|---------|------------|-------------|-------|
| `useFeatureFlag` hook | Deprecated (CLAUDE.md: use `useCapability`) | Hook exists in `src/hooks/useFeatureFlag.ts`, marked `@deprecated`, but NOT imported by any component | Dead code — safe to delete |
| `FeatureFlags` type | Replaced by `capabilities: string[]` | Type in `src/types/index.ts:357` + `featureFlags` state in SupabaseAppContext (computed but never consumed outside context) | Dead code — type + state + reducer action can be removed |
| Cash Drawer tier gating | tier-spec.md §2.1: `cash_drawer` = Growth | `useCapability('cash_drawer')` used in `CashShiftManager`, no UpgradePrompt found for locked state | Partial — capability check exists, but no visual upgrade prompt for Free users |
| Purchase Log tier gating | tier-spec.md §2.1: `purchase_log` = Growth | Referenced in inventory components via `useCapability`, no dedicated UpgradePrompt for locked state | Same as above — capability check exists, no visual prompt |

## 🟢 Design & Polish Debt

| Issue | Count | Location | Priority |
|-------|-------|----------|----------|
| Tailwind arbitrary hex (`bg-[#...]`) | 372 | ReportsManager (72), Settings (52), CheckoutModal (50), Cart (41), ProductGrid (39), Header (39), + 14 more files | Low — works, but violates design-system.md §1.6 spirit |
| Inline style hex (`color: '#...'`) | 29 | ReportsManager, Settings, CheckoutModal, and others | Low |
| **Total hex violations** | **401** | **20 files** | Low |

**Top 5 violating files:**

| File | Hex Count | Total Lines | % Violating |
|------|-----------|-------------|-------------|
| `ReportsManager.tsx` | 72 | 942 | 7.6% |
| `Settings.tsx` | 52 | 379 | 13.7% |
| `CheckoutModal.tsx` | 50 | 877 | 5.7% |
| `Cart.tsx` | 41 | 429 | 9.6% |
| `ProductGrid.tsx` | 39 | 393 | 9.9% |

## ⚠️ Dead Code / Scope Creep Remnants

| Item | Location | Action |
|------|----------|--------|
| `useFeatureFlag` hook | `src/hooks/useFeatureFlag.ts` | Delete — deprecated, zero imports |
| `useFeatureFlags` hook | `src/hooks/useFeatureFlag.ts` | Delete — same file, deprecated |
| `FeatureFlags` type | `src/types/index.ts:357` | Delete — replaced by `capabilities: string[]` |
| `featureFlags` state field | `src/context/SupabaseAppContext.tsx:37,113,252-257,415-420` | Remove from state interface, initial state, reducer, and resolution logic |
| `SET_FEATURE_FLAGS` action | `src/context/SupabaseAppContext.tsx:79,252-253` | Remove reducer case |
| `TOGGLE_FEATURE_FLAG` action | `src/context/SupabaseAppContext.tsx:256-257` | Remove reducer case |
| `deduct_raw_materials` trigger | `supabase/migrations/20260624000003_deduction_trigger.sql` | **DO NOT DELETE** — DB migration history, expected |
| `replace_recipe_lines` function | `supabase/migrations/20260624000005_atomic_recipe_lines_replace.sql` | **DO NOT DELETE** — DB migration history, expected |

## Summary Statistics

- **Total files scanned:** 58 source files (`src/**/*.ts{,x}`)
- **Critical gaps found:** 0
- **Functional gaps found:** 4 (2 dead code, 2 minor gating gaps)
- **Design debt instances:** 401 hex violations across 20 files
- **Dead code remnants:** 6 items (1 hook file, 1 type, 4 context references)

## Verification

```
$ git status
On branch feature/scope-reframe-v4
nothing to commit, working tree clean
```

*(Report file excluded from scan — it's new, not modified.)*
