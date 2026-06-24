# Concerns & Technical Debt

Analysis date: 2026-06-24
Source files: 51 files under `src/`, 14 migration files, config files

---

## Critical Issues

### 1. Checkout Inventory Race Condition (no rollback)
**Severity: HIGH** | File: `src/components/pos/CheckoutModal.tsx` (lines 345-364)

The checkout flow creates a sale, then updates inventory sequentially in a for-loop. If any inventory update fails mid-loop, the sale is already persisted but stock is partially deducted. There is no transaction or rollback mechanism.

```ts
const savedSale = await salesService.create(sale);  // Sale committed
dispatch({ type: 'ADD_SALE', payload: savedSale });

for (const item of state.cart) {  // Sequential, no rollback on failure
  try {
    await productsService.update(product.id, updatedProduct);
  } catch (error) {
    console.error(...);  // Swallowed -- sale exists but stock is wrong
  }
}
```

Customer credit/purchase-history updates have the same pattern (lines 366-391). A failed customer update leaves inconsistent credit balances.

### 2. Settings Page Has No Role Restriction
**Severity: HIGH** | File: `src/App.tsx` (line 93-94)

Every other view (transactions, inventory, customers, reports, discounts, users) checks `userRole` before rendering. The `settings` case has no guard -- cashiers can access and view all settings. While `Settings.tsx` has a client-side write check, the settings data (including API keys, store config) is fully visible to all roles.

```ts
case 'settings':
  return <Settings />;  // No role check -- unlike every other case
```

### 3. API Key Stored in Plaintext in Database
**Severity: HIGH** | Files: `src/lib/services.ts` (line 620), `src/lib/database.types.ts`

The `exchange_rate_api_key` column stores third-party API keys as plaintext in the `app_settings` table. This key is fetched client-side, loaded into React state, and rendered in a form field. Any authenticated user (including cashiers via issue #2) can read it. Same concern applies to alert service configs (SendGrid API key, AWS secret access key) stored in `alert_notification_services.config_data`.

### 4. No React Error Boundaries
**Severity: HIGH** | Entire codebase

Zero `ErrorBoundary` or `componentDidCatch` implementations. A runtime error in any component (e.g., a null reference in ReportsManager charts) crashes the entire app with a white screen. The lazy-loaded routes have `Suspense` for loading but no error fallback.

### 5. Client-Side-Only Validation
**Severity: HIGH** | Multiple files

All business logic validation (stock > 0, price > 0, password length, discount conditions) happens only in the UI. Supabase RLS provides row-level access control but no CHECK constraints or database triggers enforce business rules. A direct API call or modified client can create products with negative prices or negative stock.

---

## Technical Debt

### 6. 69 `any` Type Annotations
**Severity: MEDIUM** | 17 files

- 38 explicit `as any` casts (mostly in `src/lib/services.ts` -- 28 occurrences)
- 31 `: any` type annotations (catch blocks, Recharts formatters, reducer dispatch)

Worst offenders:
| File | Count | Pattern |
|------|-------|---------|
| `src/lib/services.ts` | 28 `as any` | JSONB columns cast without typed intermediates |
| `src/context/SupabaseAppContext.tsx` | 2 `dispatch: any` | `resetInvoiceCounter` and `setInvoicePrefix` exported with `dispatch: any` |
| `src/components/reports/ReportsManager.tsx` | 5 `: any` | Recharts tooltip formatters |
| `src/context/AuthContext.tsx` | 4 `catch (error: any)` | Error message access without type narrowing |
| `src/context/AppContext.tsx` | 9 `: any` | Deprecated file, entire hydration pipeline |

### 7. 65 console.error/log Statements in Production Code
**Severity: MEDIUM** | 28 files

Every catch block logs to console. No structured logging, no log levels, no remote logging. Examples:
- `src/lib/exchangeRateService.ts`: 10 console.log statements for operational status
- `src/lib/alertService.ts`: 7 console.error statements
- `src/components/pos/CheckoutModal.tsx`: 4 console.error in critical payment flow
- `src/context/CurrencyContext.tsx`: 5 console.error for data loading failures

### 8. Deprecated AppContext.tsx Still Present
**Severity: LOW** | File: `src/context/AppContext.tsx` (685 lines)

The entire file is dead code -- zero imports from any other file. It contains localStorage-based mock data that is fully superseded by `SupabaseAppContext.tsx`. Keeping it creates confusion about which context is active.

### 9. Unused npm Dependencies
**Severity: LOW** | File: `package.json`

| Package | Evidence |
|---------|----------|
| `react-router-dom` (6.30.x) | Zero imports across all source files |
| `@supabase/auth-ui-react` (0.4.7) | Zero imports |
| `@supabase/auth-ui-shared` (0.1.8) | Zero imports |

These add ~150KB to `node_modules` and may confuse contributors.

### 10. Dead Code: CurrencyExample Component
**Severity: LOW** | File: `src/components/examples/CurrencyExample.tsx`

Not imported anywhere. Example/demo component that was likely used during development and never removed.

### 11. Direct supabase.from() Call Bypassing Service Layer
**Severity: MEDIUM** | File: `src/context/SupabaseAppContext.tsx` (line 340)

The `shop_memberships` query in `loadData()` calls `supabase.from('shop_memberships').select(...)` directly instead of going through a service. This violates the project's own architecture rule that all DB access routes through service objects.

### 12. Mixed SweetAlert Patterns
**Severity: LOW** | File: `src/context/AuthContext.tsx` (line 109)

`AuthContext` uses raw `Swal.fire({...})` while every other file uses `swalConfig.*` helpers from `src/lib/sweetAlert.ts`. This creates inconsistent toast styling and makes future SweetAlert configuration changes error-prone.

### 13. Inconsistent Error Handling in Catch Blocks
**Severity: MEDIUM** | Multiple files

Three different patterns coexist:
1. `catch (error)` + `console.error` + `swalConfig.error` (most components)
2. `catch (_error)` + `swalConfig.error` only (AlertManager -- 7 occurrences, no logging)
3. `catch (error: any)` + `swalConfig.error(error.message)` (UserManager, AuthContext -- exposes raw error messages)

Pattern #2 loses diagnostic information. Pattern #3 exposes internal error messages to users.

### 14. Date.now() Used as ID Generator
**Severity: MEDIUM** | File: `src/components/pos/CheckoutModal.tsx` (5 occurrences)

Payment IDs, card detail IDs, and sale IDs are generated with `Date.now().toString()`. This is not cryptographically secure and can produce collisions if two operations happen within the same millisecond (e.g., split payments added rapidly). The sale ID should come from the database (`salesService.create` already returns the real ID), but payment sub-IDs within the sale object use `Date.now()`.

### 15. 20+ Inline Hex Colors Bypassing Tailwind Config
**Severity: LOW** | ~10 components

Documented in `docs/specs/technical-debt.md`. Arbitrary Tailwind values like `text-[#473b32]`, `bg-[#faf8f5]` appear throughout instead of defined Tailwind tokens. This makes theme changes require touching every file.

---

## Performance Concerns

### 16. Sequential Inventory Updates in Checkout
**Severity: MEDIUM** | File: `src/components/pos/CheckoutModal.tsx` (lines 348-364)

Each cart item's inventory is updated with a separate `await productsService.update()` call. A 10-item cart makes 10 sequential network requests. These could be parallelized with `Promise.all()` or handled server-side with a single RPC/batch update.

### 17. No Component Memoization
**Severity: MEDIUM** | Entire codebase

- 0 uses of `React.memo()` across all components
- Only 16 uses of `useCallback`/`useMemo` total (52 `useEffect` calls)

Components like `ProductGrid` (347 lines), `Cart` (400 lines), and `ReportsManager` (898 lines) re-render on every state change. In a POS system with frequent cart updates, this causes unnecessary re-renders of the entire component tree.

### 18. All Data Loaded on Login (No Pagination)
**Severity: MEDIUM** | File: `src/context/SupabaseAppContext.tsx` (lines 331-348)

Seven parallel `getAll()` calls load every product, customer, sale, discount, user, and sales tab on login. For a shop with thousands of sales records, this becomes a significant bottleneck. No pagination, no lazy loading, no incremental fetching.

### 19. O(n) Product Lookups in Hot Path
**Severity: LOW** | File: `src/components/pos/CheckoutModal.tsx` (line 350)

Inside the inventory update loop, `state.products.find(p => p.id === item.product.id)` is called per cart item. This is O(n*m) where n = cart items and m = total products. A Map lookup would be O(1) per item.

### 20. Large Monolithic Components
**Severity: MEDIUM** | Multiple files

| Component | Lines | Functions |
|-----------|-------|-----------|
| `CheckoutModal.tsx` | 881 | 18 functions, 16 useState hooks |
| `ReportsManager.tsx` | 898 | 18 functions |
| `AlertManager.tsx` | 780 | 19 functions, 16 useState hooks |
| `DiscountModal.tsx` | 712 | -- |
| `ProductModal.tsx` | 694 | -- |
| `Settings.tsx` | 629 | -- |
| `services.ts` | 1236 | All services in one file |

`CheckoutModal` alone has 16 `useState` calls. These components should be decomposed into smaller, focused sub-components.

---

## Architectural Concerns

### 21. No Client-Side Routing
**Severity: MEDIUM** | File: `src/App.tsx`

Navigation is `useState('pos')` + a `switch` statement. Despite `react-router-dom` being installed, it is unused. This means:
- No deep linking (can't bookmark or share a URL to a specific view)
- Browser back/forward buttons don't work
- No URL-based state preservation on refresh
- Makes future multi-page features (customer detail pages, order history) harder

### 22. Single Reducer for Entire Application State
**Severity: MEDIUM** | File: `src/context/SupabaseAppContext.tsx`

One `useReducer` manages products, customers, sales, cart, users, discounts, settings, sales tabs, and shop ID. Any dispatch triggers re-evaluation of the entire context tree. This should be split into domain-specific contexts (cart context, product context, etc.) or use a state management library.

### 23. Multi-Tenancy Schema Present but Not Wired
**Severity: MEDIUM** | Migration `20260620000001_shop_id_placeholder.sql`

`shop_id` columns have been added to all tables, and RLS policies reference `active_shop_id()`. However:
- Services don't pass `shop_id` in queries
- Components don't reference the active shop
- Only one direct `supabase.from('shop_memberships')` call exists (bypassing service layer)
- No UI for shop switching or shop management

### 24. Settings Update Requires Finding Existing Record
**Severity: LOW** | File: `src/lib/services.ts` (lines 591-610)

`settingsService.update()` first calls `.select('id')` to find the existing record, then updates by ID. This is a race condition if two users update settings simultaneously. Should use `upsert` or a single `UPDATE ... WHERE` pattern.

---

## Dependency Risks

### 25. Significantly Outdated Dependencies
**Severity: MEDIUM** | File: `package.json`

| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| `@supabase/supabase-js` | 2.50.5 | 2.108.2 | 58 minor versions |
| `framer-motion` | 11.x | 12.41.0 | 1 major version |
| `lucide-react` | 0.400.0 | 1.21.0 | 1 major version |
| `recharts` | 2.15.4 | 3.9.0 | 1 major version |
| `react` / `react-dom` | 18.3.1 | 19.2.7 | 1 major version |
| `@types/react` | 18.3.x | 19.2.17 | 1 major version |
| `eslint` | 9.12.0 | 10.5.0 | 1 major version |
| `eslint-plugin-react-hooks` | 5.1.0-rc | 7.1.1 | RC + 2 major versions |

The Supabase JS gap is particularly concerning -- 58 minor versions may include security patches, bug fixes, and RLS behavior changes.

### 26. Release Candidate in Production Dependencies
**Severity: LOW** | File: `package.json`

`eslint-plugin-react-hooks@5.1.0-rc-fb9a90fa48-20240614` is a pre-release version pinned from June 2024. This is a Facebook internal build hash, not an official release.

---

## Missing Infrastructure

### 27. Zero Test Coverage
**Severity: HIGH** | Entire codebase

- No test files exist (`__tests__/`, `*.test.ts`, `*.spec.ts`)
- No test dependencies in `package.json` (no vitest, jest, @testing-library)
- No `test` script in `package.json`
- CLAUDE.md describes a testing pattern but none has been implemented

### 28. No CI/CD Pipeline
**Severity: HIGH** | No `.github/workflows/` directory

No automated linting, building, testing, or deployment. Code reaches production without any automated quality gates.

### 29. No Error Monitoring or Observability
**Severity: MEDIUM** | Entire codebase

No Sentry, LogRocket, Datadog, or similar integration. Errors are only `console.error` in the browser. Production errors are invisible to the development team.

### 30. No Structured Logging
**Severity: MEDIUM** | 28 files with console statements

65 `console.error`/`console.log` calls with inconsistent message formats. No log levels, no correlation IDs, no structured data. Makes debugging production issues nearly impossible.

### 31. No Database Migration CI
**Severity: MEDIUM** | `supabase/migrations/`

14 migration files exist but there's no automated migration testing or deployment pipeline. Migrations are applied manually via Supabase CLI or dashboard.

---

## Improvement Opportunities

### Quick Wins (< 1 hour each)

| # | Task | Impact | Files |
|---|------|--------|-------|
| Q1 | Add role guard to settings case in App.tsx | Fixes security gap | `src/App.tsx` line 93 |
| Q2 | Delete deprecated `AppContext.tsx` | Removes 685 lines of dead code | `src/context/AppContext.tsx` |
| Q3 | Delete `CurrencyExample.tsx` | Removes dead code | `src/components/examples/` |
| Q4 | Remove unused deps (`react-router-dom`, `@supabase/auth-ui-react`, `@supabase/auth-ui-shared`) | Reduces bundle confusion | `package.json` |
| Q5 | Replace `dispatch: any` with `React.Dispatch<AppAction>` in `resetInvoiceCounter`/`setInvoicePrefix` | Type safety | `src/context/SupabaseAppContext.tsx` lines 504, 508 |
| Q6 | Standardize AuthContext to use `swalConfig` instead of raw `Swal.fire` | Consistency | `src/context/AuthContext.tsx` line 109 |
| Q7 | Add `_error` logging to AlertManager catch blocks | Diagnostic visibility | `src/components/alerts/AlertManager.tsx` (7 catch blocks) |

### Medium Efforts (1-4 hours each)

| # | Task | Impact | Files |
|---|------|--------|-------|
| M1 | Add a React ErrorBoundary at the App level | Prevents white-screen crashes | `src/App.tsx`, new `src/components/ui/ErrorBoundary.tsx` |
| M2 | Parallelize inventory updates with `Promise.all` | Faster checkout | `src/components/pos/CheckoutModal.tsx` lines 348-364 |
| M3 | Create `shopMembershipsService` to replace direct `supabase.from()` call | Architecture consistency | `src/lib/services.ts`, `src/context/SupabaseAppContext.tsx` |
| M4 | Add `React.memo` to ProductGrid, Cart, Header | Reduces re-renders | 3 component files |
| M5 | Extract `services.ts` into per-domain files (`productsService.ts`, `salesService.ts`, etc.) | Reduces 1236-line monolith | `src/lib/services.ts` -> multiple files |
| M6 | Define typed Supabase row interfaces to eliminate `as any` casts in services | Type safety (28 casts) | `src/lib/services.ts` |
| M7 | Replace `Date.now()` IDs with `crypto.randomUUID()` | Prevents ID collisions | `src/components/pos/CheckoutModal.tsx` |

### Larger Refactors (1+ days each)

| # | Task | Impact | Files |
|---|------|--------|-------|
| L1 | Add Vitest + React Testing Library test suite | Enables safe refactoring | New test files, `package.json`, `vite.config.ts` |
| L2 | Set up GitHub Actions CI (lint, build, test) | Quality gates | `.github/workflows/ci.yml` |
| L3 | Split SupabaseAppContext into domain-specific contexts | Performance, maintainability | `src/context/` |
| L4 | Implement client-side routing with react-router-dom | Deep linking, UX | `src/App.tsx`, all view components |
| L5 | Add pagination/lazy loading for sales and products data | Scales with data growth | `src/lib/services.ts`, `src/context/SupabaseAppContext.tsx` |
| L6 | Move checkout transaction logic to a Supabase Edge Function | Data integrity, rollback | New edge function, `CheckoutModal.tsx` |
| L7 | Integrate Sentry or similar error monitoring | Production visibility | New dependency, `src/main.tsx` |
| L8 | Encrypt API keys at rest (or move to Supabase Vault/env vars) | Security | `app_settings` table, services |
| L9 | Wire multi-tenancy through services and UI | Enables SaaS transition | All services, components, new shop management UI |
| L10 | Update Supabase JS from 2.50.5 to 2.108.x | Security patches, features | `package.json`, potential API changes |

---

## Priority Matrix

| # | Issue | Impact | Effort | Priority |
|---|-------|--------|--------|----------|
| 1 | Settings page no role guard | HIGH (security) | Trivial (1 line) | **P0** |
| 2 | No error boundaries | HIGH (UX crash) | Low (1 hr) | **P0** |
| 3 | Checkout no rollback | HIGH (data integrity) | High (edge function) | **P1** |
| 4 | Client-side-only validation | HIGH (data integrity) | Medium (DB constraints) | **P1** |
| 5 | API keys in plaintext DB | HIGH (security) | Medium (Vault/env) | **P1** |
| 6 | Zero tests | HIGH (confidence) | High (ongoing) | **P1** |
| 7 | No CI/CD | HIGH (quality) | Medium (1 day) | **P1** |
| 8 | Sequential inventory updates | MEDIUM (perf) | Low (Promise.all) | **P2** |
| 9 | All data loaded on login | MEDIUM (perf) | High (pagination) | **P2** |
| 10 | 69 `any` types | MEDIUM (type safety) | Medium (3-4 hrs) | **P2** |
| 11 | 65 console statements | MEDIUM (observability) | Medium (logging lib) | **P2** |
| 12 | Supabase JS 58 versions behind | MEDIUM (security) | Medium (testing) | **P2** |
| 13 | Single monolithic reducer | MEDIUM (perf/arch) | High (refactor) | **P3** |
| 14 | No client-side routing | MEDIUM (UX) | High (refactor) | **P3** |
| 15 | Large monolithic components | MEDIUM (maintainability) | Medium (per component) | **P3** |
| 16 | Multi-tenancy not wired | MEDIUM (feature gap) | High (full wiring) | **P3** |
| 17 | Deprecated AppContext.tsx | LOW (confusion) | Trivial (delete) | **P4** |
| 18 | Unused npm deps | LOW (confusion) | Trivial (npm uninstall) | **P4** |
| 19 | Inline hex colors | LOW (visual) | Low (1-2 hrs) | **P4** |
| 20 | Mixed SweetAlert patterns | LOW (consistency) | Trivial (15 min) | **P4** |
| 21 | Date.now() IDs | LOW (edge case) | Trivial (replace) | **P4** |

**Recommended execution order:**
1. P0 items (settings guard, error boundary) -- same day, < 2 hours total
2. P4 quick wins (delete dead code, remove unused deps, fix dispatch types) -- same day, < 1 hour
3. P2 medium items (Promise.all, any types, Supabase upgrade) -- this week
4. P1 foundational items (tests, CI, checkout integrity) -- next sprint
5. P3 architectural items (routing, context split, multi-tenancy) -- planned roadmap
