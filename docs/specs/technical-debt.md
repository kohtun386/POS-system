# Technical Debt — CoffeeShop POS

Originally captured 2026-06-16 during POS Helper lint + theme consistency audit.
Commit: `8556dc3` (159 → 140 lint problems).

Last updated: 2026-07-13 (aligned with VISION.md v3.1.0).

---

## 1. `any` Types Eroding Type Safety

**Lint count:** 0 `@typescript-eslint/no-explicit-any` errors across 17 files.
**Status:** ✅ RESOLVED (2026-07-13) — all `any` errors eliminated via typed intermediate interfaces.

### Root Cause (historical)

- **services.ts:** Service methods built camelCase-to-snake_case mapping inline without typed intermediate shapes. Each `.select()` return was typed `any` because the full joined-query shape wasn't declared.
- **Context files:** `useReducer` dispatch wasn't discriminated — action types carried `payload: any`.
- **Third-party escape hatches:** Recharts `Tooltip` passed `any` for `payload`, form libs used `any` for event targets.

---

## 2. React Refresh Warnings in Context Files

**Lint count:** 15 warnings across 6 files.

### Affected Files

| File | Warning |
|---|---|
| `src/context/AppContext.tsx` | Exports `AppProvider` + `useApp` hook + `checkDiscountEligibility` utility |
| `src/context/AuthContext.tsx` | Exports `AuthProvider` + `useAuth` hook |
| `src/context/SupabaseAppContext.tsx` | Exports `AppProvider` + `useApp` + `useInvoiceGeneration` + `checkDiscountEligibility` |
| `src/context/ThemeContext.tsx` | Exports `ThemeProvider` + `useTheme` hook |
| `src/lib/alertScheduler.tsx` | Exports `useAlertScheduler` hook + `AlertStatusIndicator` component |

### Root Cause

React Fast Refresh expects a file to export **only** React components OR **only** non-component exports. Context files export a Provider (component) **and** one or more custom hooks (non-component). Fast Refresh can't handle mixed exports — any edit forces a full remount, losing component state.

### Recommended Next Steps

1. **Extract non-component exports to sibling files.** Pattern for each context:
   ```
   src/context/AuthContext.tsx      → AuthProvider (component only)
   src/context/useAuth.ts          → useAuth hook
   ```
   The hook file imports from the context file:
   ```ts
   // src/context/useAuth.ts
   import { AuthContext } from './AuthContext';
   import { useContext } from 'react';
   export function useAuth() { return useContext(AuthContext); }
   ```

2. **For utility exports** (`checkDiscountEligibility`, `useInvoiceGeneration`, `CurrencyUtils`): move to `src/lib/` — these aren't context concerns and don't belong in context files anyway.

3. **`alertScheduler.tsx`:** Extract `AlertStatusIndicator` to `src/components/alerts/AlertStatusIndicator.tsx`. Keep `useAlertScheduler` in `src/lib/alertScheduler.tsx` (no JSX needed → back to `.ts`).

**Effort:** Low (~1 hour). Seven file splits. No logic changes, just import path updates in consumers.

---

## 3. Color Palette Drift — Inline Hex Without Tailwind Config

**Status:** 🟡 IN PROGRESS — ~401 inline hex instances remaining in 40+ files.

**Affected files:** ~40 components using non-standard hex values outside the approved Espresso & Copper palette.

### Background

The approved Espresso & Copper palette defines 6 tier-1 colors:

| Token | Hex |
|---|---|
| Primary (espresso) | `#9a693a`, `#7a4f2c` |
| Secondary (warm stone) | `#f0ece5`, `#ded7cc` |
| Accent (copper) | `#f57323`, `#e55c13` |

Everything else is inlined as arbitrary-value `text-[#xyz]` / `bg-[#xyz]`:

| Inlined Shade | Semantic Role | Files |
|---|---|---|
| `#473b32` | Darkest brown (heading text) | Cart, CheckoutModal, ProductGrid, Header |
| `#7d6b57` | Muted brown (subtitle/icons) | Header, ProductGrid, POSTerminal |
| `#ad9e8a` | Warm tan (placeholders/empty states) | ProductGrid |
| `#faf8f5` | Off-white bg (POS panels) | POSTerminal, ProductGrid |
| `#1f1309` | Dark bg (POS panels, dark mode) | POSTerminal, ProductGrid |
| `#fcf5eb` | Light amber (info cards) | ProductGrid |
| `#3b2613` | Dark amber (info cards, dark mode) | ProductGrid |
| `#fcd3a0` | Amber border (low stock) | ProductGrid |
| `#fef7ee` | Pale amber bg (low stock) | ProductGrid |
| `#fecaca` | Red border (out of stock) | ProductGrid |
| `#fef2f2` | Pale red bg (out of stock) | ProductGrid |
| `#251e18` | Overlay dark | ProductGrid |
| `#dc2626` / `#b91c1c` | Destructive red | Header, SalesTabManager, CheckoutModal |
| `#22c55e`, `#cfa16a` | Nav icon colors | Header |
| `#c6bbab` | Light text (dark mode) | ProductGrid, Header |
| `#fee2e2` | Red hover bg | Header |
| `#473b32` → `#dc2626` | Charts + grid | ReportsManager |
| `#8884d8` | Purple (pie chart) | ReportsManager |

### Root Cause

The Tailwind config never defined a full color scale. Components needed semantic shades (darker brown for text, lighter amber for info cards, red for destructive) so developers inlined them. This is correct instinct — the palette was incomplete.

### Recommended Next Steps

1. **Define full Tailwind color scales in `tailwind.config.js`:**
   ```js
   colors: {
     'primary': {
       50: '#faf8f5',  100: '#fcf5eb', 200: '#fcd3a0',
       300: '#ad9e8a', 400: '#7d6b57',  500: '#9a693a',
       600: '#7a4f2c', 700: '#473b32',  800: '#3b2613',
       900: '#1f1309', 950: '#251e18',
     },
     'accent': {
       50: '#fef7ee', 400: '#f57323', 500: '#e55c13',
     },
     'destructive': {
       50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
       500: '#dc2626', 600: '#b91c1c',
     },
     'surface': { DEFAULT: '#faf8f5', dark: '#1f1309' },
   }
   ```

2. **Replace inline hex with Tailwind tokens.** Use `sed`-based bulk replacement:
   ```
   text-[#473b32] → text-primary-700
   bg-[#faf8f5]  → bg-surface or bg-primary-50
   text-[#dc2626] → text-destructive-500
   …
   ```
   Do this file-by-file to avoid false matches.

3. **Formalize chart colors** in ReportsManager.tsx — move `COLORS` array to `src/lib/theme.ts` as a named export.

4. **Update ESLint** to add `tailwindcss/no-custom-classname` or a custom `no-restricted-syntax` rule that blocks hex patterns in className strings post-migration.

**Effort:** Medium (~1-2 hours). Bulk find-replace followed by visual regression check.

---

## 4. Migration Return Type Change Requires DROP FUNCTION

**Migration:** `20260704000005_fix_checkout_return_invoice_number.sql`
**Severity:** High — blocks `supabase db reset`
**Date identified:** 2026-07-05
**Status:** ✅ Resolved (2026-07-05) — `DROP FUNCTION IF EXISTS` added to migration

### Problem

PostgreSQL does not allow changing a function's return type with `CREATE OR REPLACE`. The migration attempts to change `checkout_complete` from `RETURNS UUID` to `RETURNS JSONB`, but uses only `CREATE OR REPLACE FUNCTION`, which fails with:

```
ERROR: cannot change return type of existing function (SQLSTATE 42P13)
```

This blocks `supabase db reset` and prevents fresh database setup.

### Root Cause

PostgreSQL requires `DROP FUNCTION` before changing return types. The `CREATE OR REPLACE` keyword only allows changing the function body, not its signature.

### Fix Required

Add `DROP FUNCTION IF EXISTS` before the `CREATE OR REPLACE`:

```sql
-- Drop existing function first (PostgreSQL requires DROP to change return type)
DROP FUNCTION IF EXISTS checkout_complete(UUID, JSONB, JSONB, UUID);

CREATE OR REPLACE FUNCTION checkout_complete(
  p_shop_id UUID,
  p_sale_data JSONB,
  p_payments JSONB,
  p_cashier_id UUID
)
RETURNS JSONB
...
```

### Prevention

Add to `docs/architecture/database.md`:

> **Rule:** When changing a function's return type, always `DROP FUNCTION` first. `CREATE OR REPLACE` only updates the function body, not its signature.

**Effort:** Low (1 line fix + doc update)

---

## 5. Resolved Items (v3.1.0)

### CurrencyContext — ✅ RESOLVED (2026-07-10)

Removed in scope reframe. MMK-only formatting is inline where needed. No multi-currency support in v1.

### FeatureFlagsManager — ✅ RESOLVED (2026-07-10)

Deleted. Capabilities are now resolved server-side via `resolveCapabilities()` and stored as `state.capabilities: string[]`. No client-side feature flag management.

### useFeatureFlag — ✅ RESOLVED (2026-07-10)

Deleted. Components use `useCapability('key')` hook instead of `useFeatureFlag`.

### Checkout Atomic RPC — ✅ RESOLVED (2026-07-10)

`checkoutService.complete()` single atomic RPC call replaces sequential JS service calls. Handles sale creation, inventory deduction, print jobs, and customer stats in one transaction. Race condition protection via `SELECT ... FOR UPDATE` in `checkout_complete` DB function.
