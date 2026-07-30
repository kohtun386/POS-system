# Technical Debt — CoffeeShop POS

Originally captured 2026-06-16 during POS Helper lint + theme consistency audit.
Commit: `8556dc3` (159 → 140 lint problems).

Last updated: 2026-07-28 (audit: any count 31→0, hex 401→114, approve-shop §6).

---

## 1. `any` Types Eroding Type Safety

**Lint count:** 0 `@typescript-eslint/no-explicit-any` errors across 17 files.
**Status:** ✅ RESOLVED (2026-07-13, sustained through 2026-07-28) — all `any` errors eliminated via typed intermediate interfaces.

### Root Cause (historical)

- **services.ts:** Service methods built camelCase-to-snake_case mapping inline without typed intermediate shapes. Each `.select()` return was typed `any` because the full joined-query shape wasn't declared.
- **Context files:** `useReducer` dispatch wasn't discriminated — action types carried `payload: any`.
- **Third-party escape hatches:** Recharts `Tooltip` passed `any` for `payload`, form libs used `any` for event targets.

---

## 2. React Refresh Warnings in Context Files

**Lint count:** 0 warnings across 6 files (rule now allows mixed exports via `allowConstantExport: true` in eslint.config.js).

### Affected Files

| File | Warning |
|---|---|
| ~~`src/context/AppContext.tsx`~~ | ~~Exports `AppProvider` + `useApp` hook + `checkDiscountEligibility` utility~~ (deleted v3.1.0) |
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

**Status:** 🟡 PARTIALLY RESOLVED — className hex migrated; 114 residual inline hex instances in 10 files remain (mostly Recharts chart colors per `design-system.md §7`, SweetAlert config per `design-system.md §9`, and a few className stragglers not yet tokenized).

**Verification date:** 2026-07-28

Per `design-system.md §1.6`: "Inline Hex Migration — Complete ✅ (2026-07-10), all className hex replaced; remaining hex are acceptable runtime values (Recharts/SweetAlert/Framer Motion)." Per `docs/README.md` (Governance section), design-system.md (architecture doc) outranks this spec.

### Residual className hex (not yet tokenized)

Found via `grep -roE '(text|bg|border|from|to|via|ring)-\[#[a-fA-F0-9]{6}\]' src/`:

| File | Hex patterns |
|---|---|
| `src/App.tsx` | `bg-[#faf8f5]`, `bg-[#1f1309]` (dark mode toggle) |
| `src/components/pos/Cart.tsx` | `text-[#86efac]`, `text-[#4ade80]`, `bg-[#f0fdf4]`, `border-[#bbf7d0]` |
| `src/components/pos/CheckoutModal.tsx` | `text-[#86efac]`, `text-[#4ade80]`, `text-[#fca5a5]`, `bg-[#f0fdf4]`, `bg-[#1a0f08]`, `bg-[#fef2f2]`, `bg-[#450a0a]`, `border-[#bbf7d0]`, `border-[#fecaca]` |
| `src/components/pos/ProductGrid.tsx` | `bg-[#fef7ee]`, `bg-[#fef2f2]`, `bg-[#fecaca]`, `bg-[#fed7aa]`, `border-[#fcd3a0]`, `border-[#fecaca]` |
| `src/components/reports/OwnerInsights.tsx` | `text-[#a8978a]`, `text-[#8a7d70]`, `text-[#059669]` |
| `src/components/reports/ProfitMarginAnalytics.tsx` | `text-[#059669]`, `bg-[#3d2d1f]` |
| `src/components/reports/WhatsAppReportConfig.tsx` | `text-[#a8978a]`, `text-[#8a7d70]`, `bg-[#3d2d1f]`, `border-[#3d2d1f]` |
| `src/components/platform/PendingShopsList.tsx` | `text-[#a8978a]`, `text-[#8a7d70]` |
| `src/components/reports/ReportsManager.tsx` | `from-[#7c3aed]`, `to-[#6d28d9]` |
| `src/lib/sweetAlert.ts` | `bg-[#9a693a]`, `bg-[#7a4f2c]` |

### Acceptable runtime hex (per design-system.md §7, §9)

- **Recharts/ReportsManager.tsx** (~43 hex values) — chart colors, grid lines, pie fills. Move `COLORS` to `src/lib/theme.ts` for cleanliness, but not technically drift.
- **Recharts/OwnerInsights.tsx** — profit chart colors.
- **Framer Motion** — animation color values (no className impact).
- **SweetAlert** — config colors in `src/lib/sweetAlert.ts`.

### Background (archived)

The Tailwind config never defined a full color scale during initial development. Components needed semantic shades so developers inlined them. The primary/secondary/accent/destructive/surface tokens are now defined in `tailwind.config.js` and the bulk className migration is complete.

### Recommended Next Steps

1. **Tokenize residual className hex** — replace the ~20 straggler hex values in className strings with the existing `primary-*`, `danger-*`, `success-*` Tailwind tokens. File list in the table above. (~30 min.)

2. **Formalize chart colors** in ReportsManager.tsx — move `COLORS` array to `src/lib/theme.ts` as a named export. (~15 min.)

3. **Update ESLint** to add a `no-restricted-syntax` rule that blocks `text-[#...]` / `bg-[#...]` patterns in className strings post-migration, to prevent backsliding. (~15 min.)

**Effort:** Low (~1 hour total). Visual regression check recommended.

---

## 4. Migration Return Type Change Requires DROP FUNCTION

**Status:** ✅ NO LONGER APPLICABLE (2026-07-28) — the migration described (`20260704000005`) was never created. The `checkout_complete` function has always been `RETURNS JSONB` from its initial creation (`20260713000009_create_checkout_complete.sql`). No return-type change was needed.

### Historical Context

This entry was written preemptively during planning for the `checkout_complete` RPC. The concern was real (PostgreSQL disallows `CREATE OR REPLACE` for return-type changes) but the migration was authored correctly from the start — the function was always JSONB.

### Prevention (still valid)

See `docs/architecture/database.md`:

> **Rule:** When changing a function's return type, always `DROP FUNCTION` first. `CREATE OR REPLACE` only updates the function body, not its signature.

---

## 5. TypeScript Strictness — `any` Errors (Resolved)

**Date identified:** 2026-07-27
**Date resolved:** 2026-07-28
**Lint count:** 0 `@typescript-eslint/no-explicit-any` errors across the codebase (0 `: any`, 0 `as any`).
**Status:** ✅ RESOLVED — eliminated by typed interface cleanup coincident with v3.1.0 merges.

### Root Cause (historical)

Likely Supabase JSONB columns (`items`, `conditions`) and Recharts data structures lacking strict interfaces. At the time of registry (2026-07-27), 31 errors were counted — these have since been resolved by subsequent typed interface work.

### Prevention

Keep `tseslint.configs.recommended` in `eslint.config.js` (includes `no-explicit-any`), and do not add `/* eslint-disable @typescript-eslint/no-explicit-any */` without a typed alternative. CI will catch regressions.

---

## 6. approve-shop Edge Function — Sequential Writes Without Transaction

**File:** `supabase/functions/platform-admin-approve-shop/index.ts`
**Severity:** LOW — manual approval ops only (1-2/day, single-shop blast radius, platform admin can recover). Per VISION.md §3.4, billing/approval is a "Manual High-Touch" workflow.
**Status:** 🔴 OPEN (Phase 5 target)

### Problem

The `platform-admin-approve-shop` edge function performs three sequential
`adminClient.from(...).update()` calls — one each on `shops`, `shop_memberships`,
and `users` — without wrapping them in a database transaction. If any write
fails after a prior write succeeded (e.g., the `users.update` fails after
`shops.update` and `shop_memberships.update` succeeded), the shop is left in a
partially-approved state:

- Shop is active with `subscription_tier = 'free'`
- Membership is active
- But the owner `users.active` is still `false`

The function returns a 500 with `details: ["user: ..."]` but cannot roll back
the completed writes because each was its own atomic call.

### Root Cause

Edge Functions using `createAdminClient()` (service_role) cannot use Postgres
transactions across multiple `.from().update()` calls — each is a separate HTTP
round-trip to PostgREST. There is no client-side transaction primitive.

### Fix Required

1. **Option A (recommended):** Consolidate all three writes into a single
   Postgres function (RPC) that runs inside a `BEGIN ... COMMIT` transaction.
   The edge function calls `supabase.rpc('approve_shop', { p_shop_id })`
   instead of three separate `.update()` calls.

2. **Option B (simpler but incomplete):** Re-order writes so the least-critical
   mutation runs first, and add a compensation step that reverses prior writes
   on failure. Fragile — still has windows where partial state is observable.

**Effort:** Low (~1 hour). Create migration for `approve_shop(p_shop_id UUID)`
RPC, rewire edge function to call it.

---

## 7. Resolved Items (v3.1.0)

### CurrencyContext — ✅ RESOLVED (2026-07-10)

Removed in scope reframe. MMK-only formatting is inline where needed. No multi-currency support in v1.

### FeatureFlagsManager — ✅ RESOLVED (2026-07-10)

Deleted. Capabilities are now resolved server-side via `resolveCapabilities()` and stored as `state.capabilities: string[]`. No client-side feature flag management.

### useFeatureFlag — ✅ RESOLVED (2026-07-10)

Deleted. Components use `useCapability('key')` hook instead of `useFeatureFlag`.

### Checkout Atomic RPC — ✅ RESOLVED (2026-07-10)

`checkoutService.complete()` single atomic RPC call replaces sequential JS service calls. Handles sale creation, inventory deduction, print jobs, and customer stats in one transaction. Race condition protection via `SELECT ... FOR UPDATE` in `checkout_complete` DB function.
