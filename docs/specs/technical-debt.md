# Technical Debt — CoffeeShop POS

Originally captured 2026-06-16 during POS Helper lint + theme consistency audit.
Commit: `8556dc3` (159 → 140 lint problems).

Last updated: 2026-08-04 (mobile nav click propagation §7 resolved, lint _ prefix config).

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

**Lint count:** 0 warnings across all files.
**Status:** ✅ RESOLVED (2026-07-31)

All hooks extracted to dedicated files (`src/hooks/`), eliminating mixed export boundaries. Context files re-export hooks for backward compatibility. `allowExportNames` added to eslint config for the three re-exported hooks.

### Affected Files

| File | Warning | Status |
|---|---|---|
| ~~`src/context/AppContext.tsx`~~ | ~~Exports `AppProvider` + `useApp` hook + `checkDiscountEligibility` utility~~ | ~~deleted v3.1.0~~ |
| ~~`src/context/AuthContext.tsx`~~ | ~~Exports `AuthProvider` + `useAuth` hook~~ | ✅ resolved 2026-07-31 |
| `src/context/SupabaseAppContext.tsx` | Exports `AppProvider` + `useApp` (active, NOT removed) | Active — the central context |
| ~~`src/context/ThemeContext.tsx`~~ | ~~Exports `ThemeProvider` + `useTheme` hook~~ | ✅ resolved 2026-07-31 |
| ~~`src/lib/alertScheduler.tsx`~~ | ~~Exports `useAlertScheduler` hook + `AlertStatusIndicator` component~~ | ✅ resolved 2026-07-31 |

### Root Cause

React Fast Refresh expects a file to export **only** React components OR **only** non-component exports. Context files export a Provider (component) **and** one or more custom hooks (non-component). Fast Refresh can't handle mixed exports — any edit forces a full remount, losing component state.

### Resolution

All hooks extracted to `src/hooks/`:
- `src/hooks/useAuth.ts` — `useAuth` hook (imports `AuthContext` from context file)
- `src/hooks/useTheme.ts` — `useTheme` hook (imports `ThemeContext` from context file)
- `src/hooks/useAlertScheduler.ts` — `useAlertScheduler` hook

Context files re-export hooks for backward compatibility:
- `src/context/AuthContext.tsx` → `export { useAuth } from '../hooks/useAuth'`
- `src/context/ThemeContext.tsx` → `export { useTheme } from '../hooks/useTheme'`
- `src/lib/alertScheduler.tsx` → `export { useAlertScheduler } from '../hooks/useAlertScheduler'`

ESLint config updated: `allowExportNames: ['useAuth', 'useTheme', 'useAlertScheduler']` suppresses the re-export warnings.

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
**Status:** ✅ RESOLVED (2026-07-30) — replaced 3 sequential UPDATE calls with `approve_shop()` atomic RPC.

### Problem (Historical)

The `platform-admin-approve-shop` edge function performed three sequential
`adminClient.from(...).update()` calls — one each on `shops`, `shop_memberships`,
and `users` — without wrapping them in a database transaction. If any write
failed after a prior write succeeded (e.g., the `users.update` fails after
`shops.update` and `shop_memberships.update` succeeded), the shop was left in a
partially-approved state.

### Root Cause

Edge Functions using `createAdminClient()` (service_role) cannot use Postgres
transactions across multiple `.from().update()` calls — each is a separate HTTP
round-trip to PostgREST. There is no client-side transaction primitive.

### Resolution

**Option A implemented** (2026-07-30):

1. Created `public.approve_shop(p_shop_id UUID, p_approver_id UUID)` RPC in
   `supabase/migrations/20260730160000_approve_shop_atomic_rpc.sql`
2. Refactored Edge Function to call `adminClient.rpc('approve_shop', ...)`
   instead of three sequential `.update()` calls
3. The RPC runs SECURITY DEFINER with `SET search_path = ''`, executes all
   three UPDATEs inside a single DB transaction, and inserts an audit log entry
4. Revoked from `anon`/`authenticated` — only callable via service_role

**RPC logic:**
- Validates shop exists and is inactive (`SHOP_NOT_FOUND`, `SHOP_ALREADY_ACTIVE`)
- Validates approver is platform_admin (`UNAUTHORIZED`)
- Validates admin membership exists (`NO_ADMIN_MEMBERSHIP`)
- Atomic updates: `shops.is_active = true`, `shop_memberships.is_active = true`, `users.active = true`
- Insert into `audit_logs`

**Pattern followed:** `provision_user()` RPC from `20260730124100_onboarding_provision_rpc.sql`.

**Security Hotfix Note:** On 2026-07-31, a security hotfix (PR #22) was applied to `REVOKE EXECUTE ON FUNCTION public.approve_shop FROM PUBLIC` to close a privilege escalation vector discovered by Greptile audit.

**Related:** `migration 20260730160000`, `docs/architecture/database.md §4`.

---

## 7. Mobile Navigation Click Propagation Bug

**Status:** ✅ RESOLVED (2026-08-04)
**PRs:** #52 (Header guard), #54 (click propagation)

### Symptom

On mobile (< 768px), the hamburger menu opens and shows all navigation tabs for admin users, but tapping a tab does nothing — the view stays on POS. Desktop navigation worked fine.

### Root Cause (two issues)

**Issue A — Timing (PR #52):**

`getNavigationItems()` in `Header.tsx:76-110` checks `state.currentUser?.role` to decide which nav items to show. Every non-POS item requires `role === 'admin' || role === 'manager'`. However, `initialState.currentUser` is `null` (`appReducer.ts:18`). During the brief window between initial render and profile load, `role = undefined` → only POS is pushed. On desktop this was invisible (icon nav re-renders after profile loads), but on mobile users who opened the hamburger during the null-state window saw only POS.

**Fix:** Guard `Header` render on `state.currentUser` being set. Show a same-height placeholder div while loading.

**Issue B — Capture-phase interference (PR #54):**

The `handleClickOutside` handler (`Header.tsx:42-46`) registers on `document` with `useCapture: true`. When a user taps a nav item:

1. Document capture listener fires → `setShowMobileMenu(false)` (menu closes)
2. React onClick should fire → `onViewChange(item.id)` (view changes)

On mobile browsers, the capture-phase state update can interfere with the React synthetic event, preventing `onViewChange` from executing. The menu closes but the view never changes.

**Fix:** Added `e.stopPropagation()` to mobile nav item and settings button `onClick` handlers to prevent the capture-phase handler from intercepting intentional nav clicks.

### Key Code Paths

| File | Line(s) | Role |
|------|---------|------|
| `src/components/layout/Header.tsx` | 76-110 | `getNavigationItems()` — role-gated nav items |
| `src/components/layout/Header.tsx` | 42-46 | `handleClickOutside` — capture-phase menu closer |
| `src/components/layout/Header.tsx` | 253, 268 | Mobile nav onClick — `e.stopPropagation()` added |
| `src/App.tsx` | 68-71 | Cashier redirect guard |
| `src/App.tsx` | 152-156 | Header render guard behind `state.currentUser` |
| `src/context/reducers/appReducer.ts` | 18 | `initialState.currentUser = null` |

### Lesson

When using capture-phase event listeners on `document` for click-outside detection, always add `e.stopPropagation()` to interactive elements inside the overlay to prevent the capture handler from swallowing intentional clicks. This is especially critical on mobile browsers where synthetic event handling differs from desktop.

---

## 8. Resolved Items (v3.1.0)

### CurrencyContext — ✅ RESOLVED (2026-07-10)

Removed in scope reframe. MMK-only formatting is inline where needed. No multi-currency support in v1.

### FeatureFlagsManager — ✅ RESOLVED (2026-07-10)

Deleted. Capabilities are now resolved server-side via `resolveCapabilities()` and stored as `state.capabilities: string[]`. No client-side feature flag management.

### useFeatureFlag — ✅ RESOLVED (2026-07-10)

Deleted. Components use `useCapability('key')` hook instead of `useFeatureFlag`.

### Checkout Atomic RPC — ✅ RESOLVED (2026-07-10)

`checkoutService.complete()` single atomic RPC call replaces sequential JS service calls. Handles sale creation, inventory deduction, print jobs, and customer stats in one transaction. Race condition protection via `SELECT ... FOR UPDATE` in `checkout_complete` DB function.

---

## 9. Capability Resolution Deviations (v3.1.3)

### 9.1 Edge Functions use direct tier conditionals instead of capabilities — §5.1 violation

**Affected files:** `supabase/functions/staff-create/index.ts`, `supabase/functions/staff-invite/index.ts`

**Problem:** Both functions gate staff creation/invitation with a direct tier conditional — `if (shop.subscription_tier === "free")` returning `TIER_UPGRADE_REQUIRED` — despite code comments claiming "verify shop has staff_accounts capability". This is a §5.1 violation: "No tier/type conditionals exist in component code" (and the spirit extends to Edge Functions, which are the server). It duplicates tier logic that `resolve_capabilities` already owns.

**Refactor follow-up:** Replace the tier check with `has_capability(shop_id, 'staff_accounts')` (or `resolve_capabilities`) so tier logic lives in exactly one place. Note: `staff-accept-invitation` has no such check (role read from invitation token).

### 9.2 Client `resolveCapabilities` helper is dead code

**Affected file:** `src/lib/services/common.ts` (function `resolveCapabilities(shop, defs)`)

**Problem:** The client-side resolver is imported only by tests (`src/lib/__tests__/services/capabilities.test.ts`). The runtime path (`src/context/SupabaseAppContext.tsx`) uses `resolveCapabilitiesRpc()` instead, so the helper can drift from the live RPC (it already omits the `pos`/`default_enabled` nuance).

**Resolution:** Remove the dead helper, or explicitly mark it as a test fixture. If kept, keep it in sync with the RPC's resolution semantics.
