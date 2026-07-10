# Technical Debt — CoffeeShop POS

Captured 2026-06-16 during POS Helper lint + theme consistency audit.
Commit: `8556dc3` (159 → 140 lint problems).

---

## 1. `any` Types Eroding Type Safety

**Lint count:** 73 `@typescript-eslint/no-explicit-any` errors across 17 files.

### Distribution

| File | Count | Context |
|---|---|---|
| `src/lib/services.ts` | 34 | Supabase query response objects cast as `any` in map callbacks, destructured assignments, and `.single()` results |
| `src/context/AppContext.tsx` | 9 | Deprecated context — most are legacy reducer dispatch payloads |
| `src/components/reports/ReportsManager.tsx` | 5 | Recharts `Tooltip` payload, chart data mappers |
| `src/context/AuthContext.tsx` | 5 | Auth state type parameter, session/profle hydration |
| `src/components/alerts/AlertManager.tsx` | 3 | Catch-block error objects, mapped config data |
| `src/context/SupabaseAppContext.tsx` | 3 | Reducer action payloads, Supabase query results |
| `src/components/alerts/ServiceModal.tsx` | 2 | Form field references, config payloads |
| `src/components/users/UserManager.tsx` | 2 | Table sort/ilter callbacks |
| `src/types/index.ts` | 2 | `AlertContext.variables: any`, `useCurrencyConversion` return type |
| 8 other files | 1 each | Scattered — catch blocks, Recharts tooltips, dynamic form values |

### Root Cause

- **services.ts:** Service methods build camelCase-to-snake_case mapping inline without typed intermediate shapes. Each `.select()` return is typed `any` because the full joined-query shape isn't declared.
- **Context files:** `useReducer` dispatch isn't discriminated — action types carry `payload: any`.
- **Third-party escape hatches:** Recharts `Tooltip` passes `any` for `payload`, form libs use `any` for event targets.

### Recommended Next Steps

1. **services.ts (highest impact, 34 occurrences):** Create typed intermediate interfaces for each service method's query result. Pattern:
   ```ts
   interface ProductRow { id: string; name: string; price: number; /* … */ }
   const { data, error } = await supabase.from('products').select('*').returns<ProductRow[]>();
   ```
   This eliminates map-callback `any` casts. Do `productsService` first as template, then replicate.

2. **Context reducers:** Define a discriminated union for each reducer's action types. Replace `payload: any` with the specific payload per action name.

3. **Scattered ~5:** These are Recharts tooltips and form-event targets — lowest priority, standard React escape-hatch patterns. Suppress with inline `// eslint-disable-next-line` comments after confirming type is unrepresentable.

**Effort:** Medium (mostly mechanical typing — ~2-3 hours for services.ts, ~1 hour for context reducers).

---

## 2. React Refresh Warnings in Context Files

**Lint count:** 26 warnings across 6 files.

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

**Affected files:** ~10 components using 20+ non-standard hex values.

### Non-Palette Colors in Use

The approved Espresso & Copper palette defines only 6 colors:

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
