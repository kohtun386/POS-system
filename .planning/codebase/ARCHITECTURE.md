# Architecture

## High-Level Architecture

**Pattern:** Client-side SPA monolith with Supabase BaaS (Backend-as-a-Service).

The application is a single-page React application that delegates all backend concerns (database, auth, storage, edge functions) to a hosted Supabase project (`ejvvwnupiqytximrbmfw`). There is no custom server -- the frontend talks directly to Supabase's PostgREST API and Auth service over HTTPS.

```
+---------------------+        HTTPS         +--------------------------+
|  React SPA (Vite)   | ------------------> |  Supabase (managed)      |
|                     |                       |                          |
|  - React 18.3       |  PostgREST API       |  - PostgreSQL (18 tables)|
|  - TypeScript 5.5   |  Auth API            |  - Auth (email/password) |
|  - Tailwind CSS 3.4 |  Realtime (unused)   |  - RLS (per-table)       |
|  - Framer Motion    |                      |  - Edge Functions (none) |
|  - Recharts         |                      |  - Storage (unused)      |
+---------------------+                      +--------------------------+
         |                                            |
         |  localStorage                              |
         +-- Cart persistence (coffeepos_cart)         |
         +-- Theme preference (theme)                 |
```

### Data Flow: User Action to Persistence

```
User clicks "Add to Cart"
    |
    v
Component calls dispatch({ type: 'ADD_TO_CART', payload: item })
    |
    v
appReducer (SupabaseAppContext.tsx) produces new state
    |
    v
React re-renders affected components
    |
    v
useEffect in AppProvider persists cart to localStorage
    |
    v
[Later] User clicks "Checkout"
    |
    v
CheckoutModal calls salesService.create(sale) + settingsService.update(...)
    |
    v
Service layer maps camelCase -> snake_case, calls supabase.from('sales').insert(...)
    |
    v
PostgREST sends INSERT to PostgreSQL
    |
    v
RLS policy checks: user is authenticated AND (user owns row OR user is admin/manager)
    |
    v
Row committed to database
    |
    v
dispatch({ type: 'ADD_SALE', payload: sale }) updates local state
```

## Component Architecture

### Provider Tree

```
<ThemeProvider>              -- Light/dark/system theme toggle, persists to localStorage
  <AuthProvider>             -- Supabase auth session, user profile from public.users
    <AppProvider>            -- All app state via useReducer (products, cart, sales, etc.)
      <CurrencyProvider>     -- Multi-currency support, exchange rates
        <AppContent />       -- Routing logic, layout shell
      </CurrencyProvider>
    </AppProvider>
  </AuthProvider>
</ThemeProvider>
```

### Component Hierarchy

```
App.tsx
  AppContent (renders based on auth state)
    LoginPage (unauthenticated)
    Header + Main Content (authenticated)
      POSTerminal
        ProductGrid (product catalog)
        Cart (current sale items)
        SalesTabManager (multi-tab sales)
        CheckoutModal (payment flow, receipt)
        ReceiptPrint (printable receipt)
      TransactionsManager (sales history)
      InventoryManager
        ProductModal (create/edit product)
      CustomerManager
        CustomerModal (create/edit)
        CustomerDetailModal (view history)
      ReportsManager (charts, export)
      DiscountManager
        DiscountModal (create/edit discount)
      UserManager (admin only)
        UserModal (create/edit user)
      Settings
        LogoUpload
        ExchangeRateManager
      AlertManager (not in nav, but wired)
        ConfigurationCard
        RecipientModal
        TemplateModal
        ServiceModal
```

### Container vs Presentational Split

The codebase does not formally separate containers and presentational components. Most components are "smart" -- they directly call `useApp()` and `useAuth()` to access state and dispatch. The few purely presentational components are:

- `src/components/ui/Button.tsx` -- Styled button wrapper with Framer Motion
- `src/components/ui/Card.tsx` -- Card container with variants
- `src/components/ui/Input.tsx` -- Styled input/select/textarea
- `src/components/ui/CurrencyDisplay.tsx` -- Currency formatting display
- `src/components/ui/LoadingComponents.tsx` -- Spinner, skeleton, progress bar

### Code Splitting

All route-level components are lazy-loaded via `React.lazy()` in `App.tsx`:

```typescript
const POSTerminal = lazy(() => import('./components/pos/POSTerminal').then(...));
const TransactionsManager = lazy(() => import('./components/transactions/TransactionsManager').then(...));
// ... 8 total lazy chunks
```

`<Suspense>` wraps the main content area with a `LoadingSpinner` fallback.

## Data Architecture

### State Management

**Approach:** `useReducer` with a single global state object via React Context (`SupabaseAppContext.tsx`).

State shape (`AppState`):

| Field             | Type           | Source           |
|-------------------|----------------|------------------|
| `products`        | `Product[]`    | Supabase         |
| `customers`       | `Customer[]`   | Supabase         |
| `sales`           | `Sale[]`       | Supabase         |
| `users`           | `User[]`       | Supabase         |
| `discounts`       | `Discount[]`   | Supabase         |
| `cart`            | `CartItem[]`   | Local + localStorage |
| `currentUser`     | `User \| null` | AuthContext profile |
| `settings`        | `AppSettings`  | Supabase         |
| `selectedCustomer`| `Customer \| null` | Local        |
| `salesTabs`       | `SalesTab[]`   | Supabase (user-scoped) |
| `activeSalesTab`  | `string`       | Local            |
| `activeShopId`    | `string`       | Supabase (shop_memberships) |
| `loading`         | `boolean`      | Local            |
| `error`           | `string \| null` | Local          |

**Reducer actions:** 28 action types covering CRUD for all entities, cart operations, settings updates, sales tab management, and shop selection.

### Caching Strategy

- **Cart:** Persisted to `localStorage` under key `coffeepos_cart` on every change. Restored on mount before Supabase data loads.
- **Theme:** Persisted to `localStorage` under key `theme`.
- **Exchange rates:** In-memory cache in `CurrencyUtils.cachedRates` (Map) with 5-minute TTL. No persistent cache.
- **Supabase data:** Loaded once on auth via `Promise.all`. No background polling or SWR pattern. Data refreshes only on full page reload or re-login.
- **PWA:** Service worker via `vite-plugin-pwa` with `autoUpdate` registration. Runtime caching for Google Fonts (CacheFirst, 1 year) and Supabase API (NetworkFirst, 5-minute max-age, 5-second timeout).

### Service Layer

All database access is abstracted through service objects in `src/lib/services.ts`. Each service:
- Calls `supabase.from('table_name')` internally
- Maps `snake_case` DB columns to `camelCase` TypeScript properties on read
- Maps `camelCase` back to `snake_case` on write
- Returns typed results

Services: `productsService`, `customersService`, `salesService`, `discountsService`, `settingsService`, `usersService`, `salesTabsService`, `alertRecipientsService`, `alertTemplatesService`, `alertConfigurationsService`, `alertHistoryService`, `notificationServiceConfigService`

Components must never call `supabase.from()` directly -- all DB access goes through these service objects.

## Auth Architecture

### Login Flow

```
1. User enters email + password on LoginPage
2. AuthContext.signIn() calls supabase.auth.signInWithPassword()
3. Supabase returns session + user
4. onAuthStateChange listener fires
5. AuthContext loads user profile from public.users table
6. AppProvider detects user + profile, calls loadData()
7. All data loaded in parallel via Promise.all
8. AppContent renders authenticated view
```

### Session Management

- Supabase handles JWT tokens with `autoRefreshToken: true`
- Sessions persist across page reloads with `persistSession: true`
- `detectSessionInUrl: true` enables magic link / OAuth redirects (not currently used)
- On sign-out, all state is reset to initial values and `initialized` flag is cleared

### Role-Based Access Control

Three roles: `admin`, `manager`, `cashier`.

| Resource          | admin | manager | cashier |
|-------------------|-------|---------|---------|
| POS Terminal      | Yes   | Yes     | Yes (only view) |
| Transactions      | Yes   | Yes     | No      |
| Inventory         | Yes   | Yes     | No      |
| Customers         | Yes   | Yes     | No      |
| Reports           | Yes   | Yes     | No      |
| Discounts         | Yes   | Yes     | No      |
| Settings          | Yes   | Yes     | No      |
| Users             | Yes   | No      | No      |

Enforcement points:
1. `App.tsx` `renderCurrentView()` -- redirects cashiers to POS
2. `Header.tsx` `getNavigationItems()` -- hides nav items by role
3. Database RLS policies -- role-aware row-level security (migration `20260618000001`)

## Key Design Decisions

### 1. Supabase as sole backend
**Decision:** Use Supabase BaaS instead of a custom Node/Express server.
**Rationale:** Eliminates server maintenance, provides built-in auth/RLS/realtime, and the POS is a relatively simple CRUD app. Trade-off: vendor lock-in to Supabase.

### 2. useReducer + Context instead of Redux/Zustand
**Decision:** Single `useReducer` with React Context for global state.
**Rationale:** App complexity does not warrant an external state library. The reducer pattern provides predictable state transitions. Trade-off: potential re-render overhead (mitigated by component-level state for transient UI).

### 3. Service layer abstraction
**Decision:** Dedicated service objects mediate all DB access.
**Rationale:** Centralizes camelCase/snake_case mapping, makes DB calls testable, prevents raw Supabase calls scattered across components. Trade-off: boilerplate for each new entity.

### 4. Lazy loading for route components
**Decision:** All 8 route-level components use `React.lazy()`.
**Rationale:** Reduces initial bundle size. The POS terminal is the most-used view; other views load on demand.

### 5. PWA with service worker
**Decision:** Full PWA with offline caching via Workbox.
**Rationale:** POS terminals may have intermittent connectivity. Static assets are pre-cached; Supabase API uses NetworkFirst with 5s timeout.

### 6. Multi-tenancy via shop_id (in progress)
**Decision:** Add `shop_id` column to all tables with RLS scoping.
**Rationale:** Enables future SaaS multi-shop support. Currently scaffolded (migration applied) but not fully wired in the UI.

### 7. SweetAlert2 for notifications
**Decision:** Use SweetAlert2 instead of a custom toast system.
**Rationale:** Rich API for toasts, confirmations, and loading modals. Custom CSS overrides in `index.css` match the Espresso & Copper theme.

## Architectural Constraints

### Current Limitations

1. **No optimistic updates:** All mutations wait for Supabase round-trip before updating local state. Network latency is visible to users.

2. **Full data load on auth:** All products, customers, sales, discounts, users, and sales tabs are loaded in parallel on login. For large datasets, this will become a bottleneck. No pagination or virtual scrolling for data lists.

3. **No real-time subscriptions:** Despite Supabase supporting Realtime, the app does not use it. Multi-device or multi-user scenarios require page refresh to see changes.

4. **Cart state in React Context:** Cart is global state, but only one POS terminal is active per browser tab. No server-side cart persistence beyond localStorage.

5. **Single Supabase project:** All environments (dev, staging, prod) share one Supabase project. No environment isolation.

### Technical Debt

1. **Deprecated `AppContext.tsx`:** Still exists in the codebase with localStorage mock data. Must not be imported -- only `SupabaseAppContext.tsx` is active.

2. **`database.types.ts` is auto-generated but incomplete:** The file defines Supabase types but the service layer does its own mapping, creating a parallel type system.

3. **`any` types in JSONB fields:** Fields like `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions` are cast as `any[]` or `any` when read from Supabase.

4. **No test suite:** No unit, integration, or E2E tests exist. Vitest and React Testing Library are compatible but not configured.

5. **Alert system not in nav:** `AlertManager` component exists but is not wired into the main navigation. Accessible only by direct import.

6. **Background exchange rate polling disabled:** The `exchangeRateService` auto-initialization is commented out in `CurrencyContext.tsx`. Only manual updates work.

7. **Sales loaded without pagination limit in context:** `salesService.getAll()` defaults to 50 items with cursor support, but the context loads all via `getAll()` with default params, which may miss older sales.
