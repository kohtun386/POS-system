# CLAUDE.md — CoffeeShop POS

## Build & Run

```bash
npm install             # Install dependencies
npm run dev             # Start dev server (Vite with --host)
npm run build           # Production build (vite build)
npm run preview         # Preview production build
npm run lint            # ESLint across all source files
```

The dev server runs on `http://localhost:5173`. Supabase credentials are in `.env` —
the Supabase project ref is `ejvvwnupiqytximrbmfw`.

## Tests

There is no test suite yet. When you add tests, follow this pattern:

- Component tests: co-locate `__tests__/ComponentName.test.tsx` with the component
- Service tests: `__tests__/services/` under `src/lib/`
- Use Vitest + React Testing Library (already compatible with the Vite toolchain)
- Run tests with `npx vitest`

## Architecture

**Stack:** React 18.3, TypeScript 5.5 (strict), Supabase, Tailwind CSS 3.4 (Espresso & Copper theme), Framer Motion, Recharts

**Layout:** All components live under `src/components/<domain>/`. Each domain (pos, inventory, customers, etc.) has a Manager component (table/list view) and Modal sub-components (forms). Reusable UI primitives are in `src/components/ui/`.

**Entry:** `src/main.tsx` → `src/App.tsx`. The provider hierarchy is:
`ThemeProvider` → `AuthProvider` → `AppProvider` → `ErrorBoundary` → `AppContent`

### State Management

- **`src/context/SupabaseAppContext.tsx`** — the **active** app state. useReducer-based with `dispatch` + `state` pattern (48 reducer actions). All product, customer, sale, user, discount, cart, settings, capabilities, and salesTab state lives here. Loads from Supabase on auth via parallel `Promise.all`. Capabilities are resolved server-side from subscription tier + per-shop overrides.

- **`src/context/AuthContext.tsx`** — Supabase auth wrapper. Provides `user`, `profile`, `session`, `isPendingApproval`, `signIn`, `signUp`, `signOut`, `updateProfile`. User profile loaded from `public.users` table. Inactive users (`profile.active === false`) see PendingApprovalPage.

- **`src/context/ThemeContext.tsx`** — Light/dark/system theme. Toggles `dark` class on `<html>`.

### Service Layer (`src/lib/services.ts`)

All DB access goes through service objects, not raw `supabase.from()`. Each service maps **camelCase** (frontend) ↔ **snake_case** (PostgreSQL). Pattern:

```ts
productsService.getAll()    // → Product[]
productsService.create(data) // → Product
productsService.update(id, partial) // → Product
productsService.delete(id)    // → void
```

Services: `productsService`, `customersService`, `salesService`, `checkoutService`, `discountsService`, `settingsService`, `usersService`, `salesTabsService`, `alertRecipientsService`, `alertTemplatesService`, `alertConfigurationsService`, `alertHistoryService`, `notificationServiceConfigService`, `shopMembershipsService`, `shopsService`, `featureDefinitionsService`, `shopFeaturesService`, `printJobsService`, `cashShiftsService`

- `checkoutService.complete()` — single atomic RPC call for all checkout operations. Replaces sequential JS calls.
- `cashShiftsService` — CRUD for shift management (open/close/query).
- `settingsService.get()` returns a single row (app_settings). `settingsService.update()` updates by finding the existing record's ID first.

### Type System

All types defined in `src/types/index.ts`. Key ones:

| Type | Notes |
|---|---|
| `Product` | `trackInventory` toggle controls stock validation; `isWeightBased` enables per-unit pricing |
| `CartItem` | `weight` for weight-based products; `discountType: 'percentage' \| 'fixed'` |
| `Payment` | `method` supports Myanmar + Sri Lankan payment methods |
| `Sale` | `paymentMethod: 'split'` when `payments` array is populated |
| `Discount` | `conditions` are JSONB in DB; `freeGiftProducts` for `type: 'free_gift'` |
| `Shop` | Business identity, subscription tier, daily order limits, receipt settings |
| `CashShift` | Open/close shift management per cashier |
| `FeatureDefinition` | Server-side feature catalog with tier gating |
| `PrintJob` | Bluetooth/network printer jobs per sale |

### Database

Supabase project: `ejvvwnupiqytximrbmfw`. Migrations in `supabase/migrations/`.

**Schema to front-end mapping rules:**
- Column names: `snake_case` in DB ↔ `camelCase` in TypeScript
- Dates: stored as `TIMESTAMP WITH TIME ZONE`, hydrated to `new Date()` in services
- JSONB columns: `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` — map directly to typed arrays/objects
- Boolean columns: `is_weight_based`, `track_inventory`, `is_active` — drop `is_` prefix in DB

**RLS:** All tables have Row Level Security enabled. Policies use `shop_id = ANY(current_shop_ids())` scoping. Sales tabs are user-scoped.

### Role-Based Access

| Role | Permissions |
|---|---|
| `platform_admin` | Cross-tenant: manages all shops, approves signups, activates subscriptions. Separate UI (src/components/platform/). Uses Edge Functions with service_role key. |
| `admin` | Everything: POS, transactions, inventory, customers, discounts, reports, users, settings |
| `manager` | POS, transactions, inventory, customers, discounts, reports, settings |
| `cashier` | POS terminal only |

Access is enforced in `App.tsx` (`renderCurrentView`) and `Header.tsx` (nav items). Cashiers redirected to POS if they try to navigate elsewhere. Platform admin sees separate component tree.

### Capability-Based Feature Gating

Features are gated by `capabilities: string[]` in state, resolved server-side from subscription tier + per-shop overrides. Components use `useCapability('key')` — never check `shop.subscriptionTier` directly.

```typescript
const canUsePrinter = useCapability('printer_integration');
const canUseCashDrawer = useCapability('cash_drawer');
```

### Tier & Feature Gating Protocol

**Source of truth:** `docs/specs/tier-spec.md` — read it before any tier/capability change.
**Document precedence:** See `docs/GOVERNANCE.md` for conflict resolution rules. Quick reference: VISION.md (scope) > tier-spec.md (implementation) > CLAUDE.md (agent rules).

| Rule | Description |
|------|-------------|
| **Read Before Write** | Always read `tier-spec.md` before changing tier assignments or feature gating |
| **Capability-Only Logic** | Gate via `useCapability('key')`, never check `shop.subscriptionTier` directly |
| **Migration First** | DB tier changes require a migration file in `supabase/migrations/`; never update `feature_definitions` without one |
| **New Features Require Tier Assignment** | Every new feature key must have a `minTier` in `tier-spec.md` before implementation starts |

**Tier hierarchy:** `free (0) → growth (1) → pro (2)` — a shop at tier N gets all features where `minTier ≤ N`.

**CI validation:** Run `npx tsx scripts/validate-tiers.ts` to verify DB matches tier-spec.md. Fails build on mismatch.

### Checkout Pattern

Checkout uses `checkoutService.complete()` — single atomic RPC call. Handles sale creation, inventory deduction, stock deduction, print jobs, and customer stats in one transaction. Never use sequential JS calls.

## Code Style

### Naming
- React components: `PascalCase` (e.g., `ProductGrid`, `CheckoutModal`)
- Functions/callbacks: prefixed with `handle` (e.g., `handleAddToCart`, `handleCheckout`)
- Service objects: `camelCase` + `Service` suffix (e.g., `productsService`)
- Context exports: `PascalCase` for Provider, `use`-prefix for hooks (e.g., `useApp`, `useAuth`)

### Component Patterns
- One component per file, named export (never default export inside `src/components/`)
- Props interfaces defined above the component
- Modals: use `.modal-overlay` + `.modal` CSS classes from `src/index.css`
- Buttons/inputs: use custom CSS classes (`.btn`, `.btn-primary`, `.input`, `.select`, `.textarea`) — NOT raw Tailwind for form elements
- Touch mode: check `state.settings.interfaceMode === 'touch'` and apply `.touch-friendly` class for larger tap targets

### State Updates
- **Always** use `dispatch()` from `useApp()`, never mutate `state` directly
- Cart operations: `ADD_TO_CART`, `UPDATE_CART_ITEM`, `REMOVE_FROM_CART`, `CLEAR_CART`
- Product operations: `ADD_PRODUCT`, `UPDATE_PRODUCT`, `DELETE_PRODUCT`
- Sales: `ADD_SALE`, `DELETE_SALE`
- Discounts: `ADD_DISCOUNT`, `UPDATE_DISCOUNT`, `DELETE_DISCOUNT`
- Settings: `SET_SETTINGS` (partial merge)

### async/Await & Error Handling
- Wrap Supabase calls in try/catch
- Use `swalConfig.error()` for user-facing error toasts (from `src/lib/sweetAlert.ts`)
- Use `swalConfig.success()` for success toasts
- Destructive operations: confirm first with `swalConfig.deleteConfirm(itemName)`
- Show loading state: `swalConfig.loading('message...')`

### ESLint
Configuration in `eslint.config.js` — TypeScript-ESLint with React hooks plugin. Run `npm run lint` before committing.

## Design System (Espresso & Copper)

**Colors** (Tailwind custom palette):
- `primary` (espresso browns): `#9a693a` / `#7a4f2c` — buttons, links, nav

- `secondary` (warm stones): `#f0ece5` / `#ded7cc` — cards, backgrounds, borders
- `accent` (copper oranges): `#f57323` / `#e55c13` — highlights, badges

**Typography:**
- Headings: `Fraunces` (serif, 600 weight, `font-fraunces` utility)
- Body: `DM Sans` (sans-serif)

**CSS Classes** (defined in `src/index.css` `@layer components`):
- `.card`, `.card-glass`, `.card-hover`
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-success`, `.btn-danger`, `.btn-ghost`
- `.btn-sm` / `.btn-md` / `.btn-lg`
- `.input`, `.select`, `.textarea`, `.input-sm`
- `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer`
- `.table`, `.table-header`, `.table-row`, `.table-cell`, `.table-header-cell`
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-accent`
- `.stat-card`, `.stat-card-success`, `.stat-card-warning`, `.stat-card-danger`

**Animations** (Framer Motion): Use `motion.div` / `motion.button` with `whileHover`, `whileTap`, `animate`, `initial` props. Keep `transition={{ duration: 0.2 }}` consistent.

## v1 Scope Boundaries (Non-Negotiable)

### Currency
**MMK only.** The app operates exclusively in Myanmar Kyat. No multi-currency, no exchange rates, no currency conversion.

### OUT OF SCOPE — Do NOT Build

| Feature | Reason |
|---------|--------|
| Recipe BOM / Bill of Materials | Too complex for Myanmar coffee shops |
| Auto-deduct ingredients on sale | Requires precise recipes; shops don't track this |
| Per-drink COGS calculation | Monthly profit (Revenue − Purchases) is sufficient |
| Consumption log per ingredient | No auto-deduction means no consumption to log |
| UOM conversion system | Not needed without recipe tracking |
| Waste tracking per recipe | No recipe tracking; use low stock alerts instead |
| Kitchen Display System (KDS) | Not practical in Myanmar; use thermal printer |
| Multi-currency / exchange rates | MMK only |

### Guard Clause
If a request implies any of the following → **STOP and ask before proceeding:**
- BOM / Bill of Materials / recipe ingredient tracking
- COGS calculation per product or per sale
- Consumption logging per ingredient
- Kitchen Display System / KDS screens
- Multi-currency support or exchange rate integration
- UOM conversion tables or logic

---

## Common Pitfalls

- **Don't import from `AppContext.tsx`** — it's deprecated. Always use `SupabaseAppContext.tsx`.
- **Don't call `supabase.from()` directly in components** — route through service objects.
- **Don't forget camelCase ↔ snake_case mapping** — services handle this; if you add a new field, add mapping in both directions.
- **Stock updates** — the checkout flow in `CheckoutModal.tsx` already handles inventory deduction. Don't duplicate this logic.
- **Invoice numbers** — use `useInvoiceGeneration()` from SupabaseAppContext, not manual string construction.
- **Discount eligibility** — use `checkDiscountEligibility()` from SupabaseAppContext; don't reimplement condition checking.
- **Alerts access** — the AlertManager component exists but is NOT wired into the nav yet. It's accessible if needed but not in the main navigation flow.
- **SalesTabs** — are user-scoped in the DB (RLS). Each user only sees their own tabs. The initial tab is auto-created on first data load if none exist.

## Key Reference Docs

| Doc | What It Covers |
|-----|----------------|
| `docs/architecture/decisions.md` | Key technology decisions (stack, architecture, database, multi-tenancy, currency, PWA, auth, security) |
| `docs/architecture/patterns.md` | Coding conventions and patterns (component structure, service layer, state updates, RLS, naming) |
| `docs/architecture/database.md` | Full database schema reference (tables, columns, types, indexes, functions) |
| `docs/architecture/auth.md` | Auth flows, role hierarchy, permission matrix, RLS policy patterns |
| `docs/architecture/state-management.md` | Provider tree, reducer actions, cart persistence, data loading |
| `docs/architecture/deployment.md` | Environment variables, local dev, Supabase config, PWA, backup |
| `docs/architecture/design-system.md` | Espresso & Copper tokens, component CSS classes, typography, animations |
| `docs/specs/prd.md` | User personas, functional requirements, acceptance criteria |
| `docs/specs/roadmap.md` | Short-term and long-term feature roadmap |
| `docs/specs/technical-debt.md` | Known debt (any types, React Refresh warnings, color drift) |
| `docs/specs/multi-tenancy.md` | Multi-tenant gap analysis and migration strategy |
| `docs/specs/inventory-alerts.md` | Alert system specification (5 alert types, email/SMS, templates) |
| `docs/specs/tier-spec.md` | **Canonical tier definitions**, capability mapping, v1.0 scope, AI harness rules |

## 🛡️ DB Safety Hook (Mandatory)
BEFORE running ANY `supabase db *`, `docker exec psql`, or migration-related commands:
1. MUST invoke `@db-guardian` to validate schema safety
2. MUST wait for "Safe to proceed" or "Proceed with caution" verdict
3. ONLY then execute the DB command
4. Log guardian verdict in `.harness/guardian-log.md`

⚠️ Violating this rule = Auto-reject command & retry with guardian check
