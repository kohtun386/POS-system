# CLAUDE.md — CoffeeShop POS

## Build & Run

Supabase credentials are in `.env` — project ref is `ejvvwnupiqytximrbmfw`.
Dev server runs on `http://localhost:5173`.

## Tests

8 test files using Vitest + React Testing Library. Run with `npx vitest`.

- Component tests: co-locate `__tests__/ComponentName.test.tsx` with the component
- Service tests: `__tests__/services/` under `src/lib/`

## Architecture

**Layout:** Components live under `src/components/<domain>/`. Each domain has a Manager component (table/list view) and Modal sub-components (forms). Reusable UI primitives are in `src/components/ui/`.

### State Management

- **`src/context/SupabaseAppContext.tsx`** — the **active** app state. useReducer-based with `dispatch` + `state` pattern (48 reducer actions). All product, customer, sale, user, discount, cart, settings, capabilities, and salesTab state lives here. Loads from Supabase on auth via parallel `Promise.all`. Capabilities are resolved server-side from subscription tier + per-shop overrides.

- **`src/context/AuthContext.tsx`** — Supabase auth wrapper. Provides `user`, `profile`, `session`, `isPendingApproval`, `signIn`, `signUp`, `signOut`, `updateProfile`. User profile loaded from `public.users` table. Inactive users (`profile.active === false`) see PendingApprovalPage.

- **`src/context/ThemeContext.tsx`** — Light/dark/system theme. Toggles `dark` class on `<html>`.

### Service Layer (`src/lib/services.ts`)

All DB access goes through service objects, not raw `supabase.from()`. Each service maps **camelCase** (frontend) ↔ **snake_case** (PostgreSQL).

- `checkoutService.complete()` — single atomic RPC call for all checkout operations. Replaces sequential JS calls.
- `cashShiftsService` — CRUD for shift management (open/close/query).
- `settingsService.get()` returns a single row (app_settings). `settingsService.update()` updates by finding the existing record's ID first.
- `platformAdminService` — all platform admin operations via Edge Functions. Uses `supabase.functions.invoke()`, NEVER `supabase.from()`. See VISION.md §17.4.

### Database

Supabase project: `ejvvwnupiqytximrbmfw`. Migrations in `supabase/migrations/`.

**Schema to front-end mapping rules:**
- Column names: `snake_case` in DB ↔ `camelCase` in TypeScript
- Dates: stored as `TIMESTAMP WITH TIME ZONE`, hydrated to `new Date()` in services
- JSONB columns: `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` — map directly to typed arrays/objects
- Boolean columns: `is_weight_based`, `track_inventory`, `is_active` — drop `is_` prefix in DB

**RLS:** All tables have Row Level Security enabled. Policies use `shop_id = ANY(current_shop_ids())` scoping. Sales tabs are user-scoped.

### Role-Based Access

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

## Design System (Espresso & Copper)

See `.claude/skills/design-system/SKILL.md` for colors, typography, CSS classes, and animation patterns. Key rule: use `.btn`/`.input`/`.modal-overlay` CSS classes — NOT raw Tailwind for form elements.

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

### Documentation-Driven Development (DDD)

**ALWAYS refer to `docs/vision/VISION.md` v3.1.0 as the Single Source of Truth for business logic.** Technical implementation details belong in architecture docs (`docs/architecture/`) and feature specs (`docs/specs/`).

**When in doubt about feature scope, check VISION.md §19 (What We Are NOT Building).**

Document precedence: VISION.md (scope) > tier-spec.md (implementation) > CLAUDE.md (agent rules). See `docs/GOVERNANCE.md` for conflict resolution.

### Valid Capability Keys (18 total — VISION.md v3.1.0 §5.5)

**DO NOT invent capability keys not in this list.** Components check these via `state.capabilities.includes('key')`.

| Capability | Min Tier |
|------------|----------|
| `pos` | free |
| `inventory` | free |
| `discounts` | free |
| `draft_sales` | free |
| `customer_management` | free |
| `batch_tracking` | free |
| `weight_based_products` | free |
| `credit_system` | free |
| `multi_tab_sales` | free |
| `printer_integration` | growth |
| `purchase_log` | growth |
| `stock_overview` | growth |
| `low_stock_alerts` | growth |
| `staff_accounts` | growth |
| `cash_drawer` | growth |
| `owner_insights` | pro |
| `simple_profit_report` | pro |
| `advanced_reports` | pro |

### MMK-Only Currency Rule

Myanmar market only — MMK currency. No multi-currency, no exchange rates, no currency conversion. `multi_currency` is DEAD (VISION.md v3.1.0 §19).

### Platform Admin Pattern

Platform admin operations MUST use `supabase.functions.invoke()` only. Never use `supabase.from()` for platform admin operations. All operations route through Edge Functions with `service_role` key, bypassing RLS entirely (VISION.md v3.1.0 §4.3, §17).

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

## 🛡️ DB Safety Hook (Mandatory)
BEFORE running ANY `supabase db *`, `docker exec psql`, or migration-related commands:
1. MUST invoke `@db-guardian` to validate schema safety
2. MUST wait for "Safe to proceed" or "Proceed with caution" verdict
3. ONLY then execute the DB command
4. Log guardian verdict in `.harness/guardian-log.md`

⚠️ Violating this rule = Auto-reject command & retry with guardian check
