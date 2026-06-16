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
`ThemeProvider` → `AuthProvider` → `AppProvider` → `CurrencyProvider` → `AppContent`

### State Management

- **`src/context/SupabaseAppContext.tsx`** — the **active** app state. useReducer-based with `dispatch` + `state` pattern. All product, customer, sale, user, discount, cart, settings, and salesTab state lives here. Loads from Supabase on auth via parallel `Promise.all`.

- **`src/context/AppContext.tsx`** — **DEPRECATED.** Contains old localStorage-based mock data. Do NOT import from here. Always use `SupabaseAppContext`.

- **`src/context/AuthContext.tsx`** — Supabase auth wrapper. Provides `user`, `profile`, `session`, `signIn`, `signUp`, `signOut`, `updateProfile`. User profile loaded from `public.users` table.

- **`src/context/ThemeContext.tsx`** — Light/dark/system theme. Toggles `dark` class on `<html>`.

- **`src/context/CurrencyContext.tsx`** — Multi-currency support. Provides `convertAmount`, `formatAmount`, `updateExchangeRates`. Use `src/lib/currencyUtils.ts` for the CurrencyUtils class.

### Service Layer (`src/lib/services.ts`)

All DB access goes through service objects, not raw `supabase.from()`. Each service maps **camelCase** (frontend) ↔ **snake_case** (PostgreSQL). Pattern:

```ts
productsService.getAll()    // → Product[]
productsService.create(data) // → Product
productsService.update(id, partial) // → Product
productsService.delete(id)    // → void
```

Services: `productsService`, `customersService`, `salesService`, `discountsService`, `settingsService`, `usersService`, `salesTabsService`, `alertRecipientsService`, `alertTemplatesService`, `alertConfigurationsService`, `alertHistoryService`, `notificationServiceConfigService`

`settingsService.get()` returns a single row (app_settings). `settingsService.update()` updates by finding the existing record's ID first.

### Type System

All types defined in `src/types/index.ts`. Key ones:

| Type | Notes |
|---|---|
| `Product` | `trackInventory` toggle controls stock validation; `isWeightBased` enables per-unit pricing |
| `CartItem` | `weight` for weight-based products; `discountType: 'percentage' \| 'fixed'` |
| `Payment` | `method` supports Myanmar + Sri Lankan payment methods |
| `Sale` | `paymentMethod: 'split'` when `payments` array is populated |
| `Discount` | `conditions` are JSONB in DB; `freeGiftProducts` for `type: 'free_gift'` |

### Database

Supabase project: `ejvvwnupiqytximrbmfw`. Migrations in `supabase/migrations/`.

**Schema to front-end mapping rules:**
- Column names: `snake_case` in DB ↔ `camelCase` in TypeScript
- Dates: stored as `TIMESTAMP WITH TIME ZONE`, hydrated to `new Date()` in services
- JSONB columns: `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` — map directly to typed arrays/objects
- Boolean columns: `is_weight_based`, `track_inventory`, `is_active` — drop `is_` prefix in DB

**RLS:** All tables have Row Level Security enabled. Policies grant full access to `authenticated` users. Sales tabs are user-scoped.

### Role-Based Access

| Role | Permissions |
|---|---|
| `admin` | Everything: POS, transactions, inventory, customers, discounts, reports, users, settings |
| `manager` | POS, transactions, inventory, customers, discounts, reports, settings |
| `cashier` | POS terminal only |

Access is enforced in `App.tsx` (`renderCurrentView`) and `Header.tsx` (nav items). Cashiers redirected to POS if they try to navigate elsewhere.

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

## Common Pitfalls

- **Don't import from `AppContext.tsx`** — it's deprecated. Always use `SupabaseAppContext.tsx`.
- **Don't call `supabase.from()` directly in components** — route through service objects.
- **Don't forget camelCase ↔ snake_case mapping** — services handle this; if you add a new field, add mapping in both directions.
- **Stock updates** — the checkout flow in `CheckoutModal.tsx` already handles inventory deduction. Don't duplicate this logic.
- **Invoice numbers** — use `useInvoiceGeneration()` from SupabaseAppContext, not manual string construction.
- **Discount eligibility** — use `checkDiscountEligibility()` from SupabaseAppContext; don't reimplement condition checking.
- **Alerts access** — the AlertManager component exists but is NOT wired into the nav yet. It's accessible if needed but not in the main navigation flow.
- **SalesTabs** — are user-scoped in the DB (RLS). Each user only sees their own tabs. The initial tab is auto-created on first data load if none exist.
