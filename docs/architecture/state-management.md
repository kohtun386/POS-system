# State Management Architecture — CoffeeShop POS

**Last updated:** 2026-07-14 (Aligned with VISION.md v3.1.0: receipt state §9, shift state §12, checkout RPC §11)
**Source of truth:** `src/context/SupabaseAppContext.tsx` (active), `src/context/AuthContext.tsx`, `src/context/ThemeContext.tsx`

---

## 1. Provider Tree

```
<ThemeProvider>                    — theme state (light/dark/system)
  <AuthProvider>                   — Supabase auth session + user profile
    <AppProvider>                  — ALL app state (products, cart, sales, etc.)
      <ErrorBoundary>              — catch rendering errors
        <AppContent />             — Routes + header
      </ErrorBoundary>
    </AppProvider>
  </AuthProvider>
</ThemeProvider>
```

Defined in `src/App.tsx`.

**Rule:** Providers must wrap in this exact order. `AppProvider` depends on `useAuth()`. CurrencyContext was removed — MMK-only formatting is inline where needed.

---

## 2. Context Inventory

| Context | File | State Type | Key Exports |
|---------|------|-----------|-------------|
| `ThemeContext` | `src/context/ThemeContext.tsx` | `useState` | `isDark`, `toggleTheme`, `setTheme`, `theme` |
| `AuthContext` | `src/context/AuthContext.tsx` | `useState` × 4 | `user`, `profile`, `session`, `loading`, `signIn`, `signUp`, `signOut`, `updateProfile` |
| `AppContext` (active) | `src/context/SupabaseAppContext.tsx` | `useReducer` | `state`, `dispatch` |
| `AppContext` (deprecated) | `src/context/AppContext.tsx` | `useReducer` | **DO NOT IMPORT.** localStorage mock data only. |

---

## 3. AppProvider — Core State (SupabaseAppContext.tsx)

### 3.1 AppState Shape

```typescript
interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  users: User[];
  discounts: Discount[];
  cart: CartItem[];
  currentUser: User | null;
  shop: Shop;              // Business identity + POS behavior
  settings: AppSettings;   // Global/preferences-style settings only
  selectedCustomer: Customer | null;
  salesTabs: SalesTab[];
  activeSalesTab: string;
  activeShopId: string;
  capabilities: string[];  // Feature flags — flat list of capability keys
  loading: boolean;
  error: string | null;
}
```

`Shop` owns store name, address, phone, email, logo, tax rate, currency, base currency, invoice prefix/counter, business type, subscription tier, daily_order_limit, receipt_setting, and draft retention.

`AppSettings` owns interface mode, auto backup, receipt printer, theme, and exchange-rate provider/key/update interval. It must not contain store identity, tax, currency, or invoice fields in the target architecture.

`capabilities` is a flat string array of capability keys (e.g., `['pos', 'inventory', 'printer_integration', 'purchase_log']`). Resolved server-side at login from subscription tier, business type, and per-shop overrides. Components check `capabilities.includes('key')` — never check `shop.subscriptionTier` or `shop.businessType` directly. (VISION.md v3.1.0 Section 5)

### 3.2 Action Types (~44 actions)

| Action | Payload | Behavior |
|--------|---------|----------|
| `SET_LOADING` | `boolean` | Set loading spinner |
| `SET_ERROR` | `string \| null` | Set error message |
| **Products** | | |
| `SET_PRODUCTS` | `Product[]` | Replace all products |
| `ADD_PRODUCT` | `Product` | Append to products |
| `UPDATE_PRODUCT` | `Product` | Replace by id |
| `DELETE_PRODUCT` | `string` (id) | Remove by id |
| **Customers** | | |
| `SET_CUSTOMERS` | `Customer[]` | Replace all customers |
| `ADD_CUSTOMER` | `Customer` | Append |
| `UPDATE_CUSTOMER` | `Customer` | Replace by id |
| `DELETE_CUSTOMER` | `string` (id) | Remove by id |
| **Cart** | | |
| `SET_CART` | `CartItem[]` | Replace cart |
| `ADD_TO_CART` | `CartItem` | Append item |
| `UPDATE_CART_ITEM` | `{ index, item }` | Replace item at index |
| `REMOVE_FROM_CART` | `number` (index) | Remove item at index |
| `CLEAR_CART` | — | Empty cart + clear selectedCustomer |
| **User** | | |
| `SET_CURRENT_USER` | `User \| null` | Set logged-in user profile |
| `SET_SELECTED_CUSTOMER` | `Customer \| null` | Set customer for current sale |
| **Sales** | | |
| `SET_SALES` | `Sale[]` | Replace all sales |
| `ADD_SALE` | `Sale` | Append sale |
| `DELETE_SALE` | `string` (id) | Remove by id |
| **Settings** | | |
| `SET_SETTINGS` | `Partial<AppSettings>` | Merge preference/global settings only |
| `SET_SHOP` | `Partial<Shop>` | Merge business identity/POS config into `state.shop` |
| ~~`INCREMENT_INVOICE_COUNTER`~~ | ~~`number`~~ | **DEPRECATED.** Invoice counter mutation belongs to the atomic DB function `generate_invoice_number(p_shop_id)`. No frontend reducer action for checkout flows. |
| **Discounts** | | |
| `SET_DISCOUNTS` | `Discount[]` | Replace all |
| `ADD_DISCOUNT` | `Discount` | Append |
| `UPDATE_DISCOUNT` | `Discount` | Replace by id |
| `DELETE_DISCOUNT` | `string` (id) | Remove by id |
| **Sales Tabs** | | |
| `SET_SALES_TABS` | `SalesTab[]` | Replace all tabs |
| `ADD_SALES_TAB` | `SalesTab` | Append + set as active + load its cart |
| `UPDATE_SALES_TAB` | `{ id, updates }` | Merge updates into tab by id |
| `REMOVE_SALES_TAB` | `string` (id) | Remove + activate first remaining |
| `SET_ACTIVE_SALES_TAB` | `string` (id) | Switch active tab + load its cart/customer |
| **Shop** | | |
| `SET_ACTIVE_SHOP` | `string` (shop_id) | Set active shop for multi-tenant scoping |
| **Capabilities** | | |
| `SET_CAPABILITIES` | `string[]` | Replace capabilities array (set at login) |

### 3.3 Cart Persistence

Cart state persists across page refresh via two mechanisms:

1. **localStorage** (`CART_STORAGE_KEY = 'coffeepos_cart'`):
   - `loadPersistedCart()` — called on mount before Supabase load
   - `persistCart(cart, selectedCustomer)` — called on every cart/customer change
   - Format: `{ cart: CartItem[], selectedCustomer: Customer | null }`

2. **Supabase sales_tabs** (for multi-tab):
   - Each tab's cart saved to `sales_tabs.cart` JSONB column on tab switch
   - Loaded from Supabase on data init and tab switch

**Priority:** localStorage restores first (instant), then Supabase tabs load and may override if tabs exist.

### 3.4 Data Loading

On auth (user + profile available), `loadData()` runs:

```typescript
const [shop, products, customers, sales, discounts, settings, users, salesTabs] = await Promise.all([
  shopsService.getByUserId(user.id),
  productsService.getAll(),
  customersService.getAll(),
  salesService.getAll().then(r => r.data),
  discountsService.getAll(),
  settingsService.get(),
  usersService.getAll(),
  salesTabsService.getByUserId(user.id)
]);
```

All data queries run in parallel after auth/profile are available. Shop loading is required for business identity, POS configuration, and approval gating. If any critical query fails, error is dispatched. On logout, all state resets to initial.

**Capability loading:** After shop loads, capabilities are resolved server-side and dispatched via `SET_CAPABILITIES`. The server reads `shop.subscription_tier`, `shop.business_type`, and `shop_features` to produce the flat capability array.

If no sales tabs exist, initial tab auto-created:
```typescript
if (salesTabs.length === 0 && user) {
  const newTab = await salesTabsService.create(user.id, { name: 'Sale 1', cart: [], selectedCustomer: null });
  dispatch({ type: 'ADD_SALES_TAB', payload: newTab });
}
```

### 3.5 Exported Hooks

| Hook | Purpose |
|------|---------|
| `useApp()` | Returns `{ state, dispatch }`. Every component uses this. |
| `useInvoiceGeneration()` | Returns async function that requests an invoice number from the DB-owned atomic invoice path. |
| `useInvoiceStats()` | Returns function that computes invoice statistics from current state. |
| `getActiveShopId(state)` | Returns `state.activeShopId`. For future service layer injection. |
| `useActiveShopId()` | Hook returning active shop ID from context. For future service layer injection. |

### 3.6 Exported Utility Functions

| Function | Purpose |
|----------|---------|
| `checkDiscountEligibility(discount, cart, customer, paymentMethod, total, cardDetails?)` | Returns boolean. Checks active, date range, valid days, all conditions. |
| `getNextInvoiceNumber` | Deprecated for source-of-truth generation; display-only helpers must not mutate counters. |
| `generateNextInvoiceNumber` | Deprecated for persistence; invoice generation must use the atomic DB function/RPC path. |
| `resetInvoiceCounter` | Deprecated except for explicitly approved administrative reset workflows. |
| `setInvoicePrefix` | Replaced by shop configuration updates through `shopsService`. |

---

## 4. AuthContext

### 4.1 State Shape

```typescript
interface AuthContextType {
  user: SupabaseUser | null;       // Supabase auth user
  profile: User | null;            // public.users row
  session: Session | null;         // Supabase session
  loading: boolean;
  signIn: (email, password) => Promise<void>;
  signUp: (email, password, name, username) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}
```

### 4.2 Auth Flow

1. `supabase.auth.getSession()` on mount → set session/user
2. `supabase.auth.onAuthStateChange()` listener → update on any auth event
3. `loadProfile(userId)` → `supabase.from('users').select('*').eq('id', userId).single()` → set profile
4. On logout: profile set to null, loading set to false

### 4.3 User Creation Flow

Sign up → `supabase.auth.signUp()` → DB trigger `handle_new_auth_user()` creates user + shop + membership → frontend fetches trigger-created row → sets profile.

Admin creates user → saves admin session → signUp → trigger creates profile → restores admin session → UPDATES profile with chosen role.

---

## 5. ThemeContext

### 5.1 State Shape

```typescript
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  theme: 'light' | 'dark' | 'system';
}
```

### 5.2 Behavior

- Persists to `localStorage` key `'theme'`
- `system` mode: reads `window.matchMedia('(prefers-color-scheme: dark)')`, toggles `.dark` class on `<html>`
- Tailwind `darkMode: 'class'` picks up the class

---

## 6. Component → State Access Patterns

### 6.1 POS Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `POSTerminal` | `state.cart`, `state.activeSalesTab`, `state.currentUser`, `state.shop`, `state.settings`, `state.capabilities` | `ADD_TO_CART`, `UPDATE_CART_ITEM`, `UPDATE_SALES_TAB`, `CLEAR_CART` |
| `ProductGrid` | `state.products`, `state.shop`, `state.settings`, `state.capabilities` | — |
| `Cart` | `state.cart`, `state.selectedCustomer`, `state.customers`, `state.shop`, `state.settings` | `UPDATE_CART_ITEM`, `REMOVE_FROM_CART`, `SET_SELECTED_CUSTOMER` |
| `CheckoutModal` | `state.cart`, `state.selectedCustomer`, `state.discounts`, `state.products`, `state.shop`, `state.settings`, `state.currentUser`, `state.capabilities` | `ADD_SALE`, `CLEAR_CART` (inventory deduction, customer stats, print jobs, consumption logging all handled by `checkout_complete` RPC) |
| `SalesTabManager` | `state.salesTabs`, `state.activeSalesTab`, `state.cart`, `state.selectedCustomer` | `ADD_SALES_TAB`, `UPDATE_SALES_TAB`, `REMOVE_SALES_TAB`, `SET_ACTIVE_SALES_TAB` |

### 6.2 Management Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `InventoryManager` | `state.products`, `state.capabilities` | — |
| `ProductModal` | `state.capabilities` | `ADD_PRODUCT`, `UPDATE_PRODUCT` |
| `CustomerManager` | `state.customers` | `DELETE_CUSTOMER` |
| `CustomerModal` | — | `ADD_CUSTOMER`, `UPDATE_CUSTOMER` |
| `DiscountManager` | `state.discounts` | `DELETE_DISCOUNT` |
| `DiscountModal` | `state.products` (for free gift selection) | `ADD_DISCOUNT`, `UPDATE_DISCOUNT` |
| `TransactionsManager` | `state.sales`, `state.shop`, `state.capabilities` | — |
| `ReportsManager` | `state.sales`, `state.products`, `state.customers`, `state.shop` | — |
| `UserManager` | `state.users`, `state.currentUser` | `SET_USERS` |
| `UserModal` | `state.users`, `state.currentUser` | `SET_USERS` |
| `Settings` | `state.shop`, `state.settings`, `state.currentUser`, `state.capabilities` | `SET_SHOP`, `SET_SETTINGS` |
| `ShiftManager` | `state.capabilities` | — |

### 6.3 Layout Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `Header` | `state.currentUser`, `state.shop`, `state.settings`, `state.cart`, `state.capabilities` | `SET_SETTINGS` (interface mode toggle) |
| `LoginPage` | — | — (uses `useAuth()` only) |

### 6.4 Capability-Based Feature Gating

Components check `state.capabilities` to show/hide features. Never check `shop.subscriptionTier` or `shop.businessType` directly.

```typescript
// CORRECT — check capabilities
const { state } = useApp();
const canUsePrinter = state.capabilities.includes('printer_integration');
const canUsePurchaseLog = state.capabilities.includes('purchase_log');
const canUseCashDrawer = state.capabilities.includes('cash_drawer');
const canUseOwnerInsights = state.capabilities.includes('owner_insights');

// WRONG — never do this
if (shop.subscriptionTier === 'pro') { ... }
if (shop.businessType === 'coffee_shop') { ... }
```

**Common capability checks:**

| Capability | Used By | Purpose |
|------------|---------|---------|
| `printer_integration` | CheckoutModal, TransactionsManager, Settings | Show/hide print buttons, receipt settings |
| `purchase_log` | InventoryManager, ReportsManager | Show/hide purchase log (Growth+) |
| `stock_overview` | InventoryManager | Show/hide stock overview (Growth+) |
| `low_stock_alerts` | AlertManager, InventoryManager | Show/hide low stock alert config (Growth+) |
| `inventory` | InventoryManager, ReportsManager | Show/hide simplified inventory features (Growth+) |
| `cash_drawer` | Header, ShiftManager | Show/hide shift management nav |
| `owner_insights` | Header, ReportsManager | Show/hide P&L dashboard, owner reports |
| `profit_report` | ReportsManager | Show/hide simple profit report (Pro) |

---

## 7. State Flow Diagrams

### 7.1 Checkout Flow (VISION.md v3.1.0 — Atomic RPC)

```
Cart (user taps "Checkout")
  │
  ▼
CheckoutModal opens
  │
  ├─ checkDiscountEligibility() for each discount
  │   └─ appliedDiscounts + freeGifts state
  │
  ├─ User selects payment method
  │   └─ Card: cardDetails state
  │   └─ Split: payments[] state
  │
  ├─ User clicks "Complete Payment"
  │   │
  │   ▼
  │   supabase.rpc('checkout_complete', {
  │     p_shop_id: state.shop.id,
  │     p_cart: cart,
  │     p_payment: payment,
  │     p_cashier_id: user.id
  │   })
  │   │
  │   ├─ Error: DAILY_LIMIT_REACHED
  │   │   └─ swalConfig.warning() with upgrade prompt
  │   │
  │   ├─ Error: other
  │   │   └─ swalConfig.error() — entire transaction rolled back
  │   │
  │   ▼
  │   Success (all steps atomic):
  │     ✓ Sale created
  │     ✓ Inventory deducted (simple stock deduction)
  │     ✓ Print jobs created (kitchen printer, if Growth+)
  │     ✓ Customer stats updated
  │     ✓ Daily order limit checked (race condition safe)
  │   │
  │   ▼
  │   dispatch({ type: 'ADD_SALE', payload: mapSale(data) })
  │   dispatch({ type: 'CLEAR_CART' })
  │   │
  │   ▼
  │   If capabilities.includes('printer_integration'):
  │     Show "Print Receipt?" prompt (based on shop.receipt_setting)
  │   Else:
  │     No print prompt (Free tier)
  │
  ▼
onComplete(sale) → POSTerminal clears tab cart
```

**Key difference from pre-v3.0.0:** No sequential JavaScript service calls. Single `supabase.rpc('checkout_complete', ...)` call handles everything atomically. All steps succeed together or all roll back together.

### 7.2 Sales Tab Switch Flow

```
User clicks tab button
  │
  ▼
SalesTabManager.switchTab(tabId)
  │
  ├─ Save current tab: salesTabsService.update(activeTabId, { cart, selectedCustomer })
  │   └─ dispatch UPDATE_SALES_TAB
  │
  ▼
dispatch SET_ACTIVE_SALES_TAB(tabId)
  │
  ├─ Reducer: finds tab by id
  ├─ Sets activeSalesTab = tabId
  ├─ Sets cart = tab.cart
  ├─ Sets selectedCustomer = tab.selectedCustomer
  │
  ▼
Cart renders with new tab's items
```

### 7.3 Auth State Change Flow

```
supabase.auth.onAuthStateChange(event, session)
  │
  ├─ SIGNED_IN:
  │   setSession(session) → setUser(session.user)
  │   loadProfile(userId) → setProfile(user row)
  │   │
  │   ▼
  │   AppProvider useEffect: user + profile available → loadData()
  │   │
  │   ▼
  │   Promise.all([shop, products, customers, sales, discounts, settings, users, salesTabs])
  │   dispatch all → state populated
  │   │
  │   ▼
  │   Resolve capabilities from server → dispatch SET_CAPABILITIES
  │
  ├─ SIGNED_OUT:
  │   setSession(null) → setUser(null) → setProfile(null)
  │   │
  │   ▼
  │   AppProvider useEffect: user null →
  │     dispatch SET_PRODUCTS([])
  │     dispatch SET_CUSTOMERS([])
  │     dispatch SET_SALES([])
  │     dispatch SET_USERS([])
  │     dispatch SET_DISCOUNTS([])
  │     dispatch SET_SALES_TABS([])
  │     dispatch CLEAR_CART
  │     dispatch SET_CURRENT_USER(null)
  │     dispatch SET_CAPABILITIES([])
  │     setInitialized(false)
```

---

## 7.4 Receipt Management State (Growth+, VISION.md v3.1.0 §9)

Receipt state lives in component-local state (not AppState reducer) because it is transient — only relevant during the post-checkout prompt flow.

| State | Location | Purpose |
|-------|----------|---------|
| `showPrintPrompt` | `CheckoutModal` local state | Whether "Print Receipt?" dialog is visible post-checkout |
| `shop.receipt_setting` | `state.shop` (persisted) | Shop-level preference: `'always'` \| `'ask'` \| `'never'` |

**Post-checkout flow (VISION.md v3.1.0 §9.1):**
1. Sale completes via `checkout_complete` RPC (always committed)
2. If `capabilities.includes('printer_integration')` AND printer connected:
   - `receipt_setting === 'always'` → auto-print, no prompt
   - `receipt_setting === 'ask'` → show `showPrintPrompt` dialog
   - `receipt_setting === 'never'` → no prompt
3. If Free tier (no `printer_integration` capability): no prompt, no print option
4. If Growth+ but no printer configured: no prompt

---

## 7.5 Shift Management State (Growth+, VISION.md v3.1.0 §12)

Shift state is managed via `cashShiftsService` and component-local state. The current shift is loaded on shift page entry, not persisted in AppState.

| State | Location | Purpose |
|-------|----------|---------|
| `currentShift` | `ShiftManager` local state | Currently open shift row from `cash_shifts` table |
| `openingCash` | `ShiftManager` form state | Physical cash count entered at shift start |
| `closingCash` | `ShiftManager` form state | Physical cash count entered at shift end |
| `expectedCash` | Computed | `opening_cash + cash_sales - cash_refunds` |
| `variance` | Computed | `closing_cash - expected_cash` |

**Shift lifecycle (VISION.md v3.1.0 §12.2):**
```
Open:  INSERT cash_shifts (opening_cash, cashier_id, status='open')
  → All sales during shift linked via cashier_id
Close: UPDATE cash_shifts (closing_cash, expected_cash, variance, status='closed')
  → Variance thresholds: Green ≤1,000 | Yellow ≤10,000 | Red >10,000 MMK
```

**DB table:** `cash_shifts` (§7.7 in database.md). Columns: `id`, `shop_id`, `cashier_id`, `opening_cash`, `closing_cash`, `expected_cash`, `variance`, `status`, `opened_at`, `closed_at`.

**RLS:** Cashiers can SELECT/INSERT/UPDATE own shifts; admin/manager can SELECT all, UPDATE all, DELETE (admin only).

---

## 8. Anti-Patterns (What NOT To Do)

| Anti-Pattern | Why | Correct Pattern |
|-------------|-----|-----------------|
| Import from `AppContext.tsx` | Deprecated. Uses localStorage mock data. | Import from `SupabaseAppContext.tsx` |
| Call `supabase.from()` in components | Bypasses service layer. No camelCase↔snake_case mapping. | Use service objects from `src/lib/services.ts` |
| Mutate `state` directly | Breaks React rendering. Reducer won't fire. | Always `dispatch()` |
| Sequential JS service calls for checkout | Leaves data inconsistent if middle step fails. Double-deduction, duplicate invoices. | Use `supabase.rpc('checkout_complete', ...)` — single atomic transaction |
| Duplicate stock deduction logic | `checkout_complete` RPC already handles inventory deduction, consumption logging, and print jobs. | Let the RPC handle everything. |
| Build invoice number manually | Frontend counter increments can duplicate invoices under concurrency. | Use the DB-backed `useInvoiceGeneration()` path. |
| Reimplement discount eligibility | `checkDiscountEligibility()` handles all 6 condition types. | Use exported utility function. |
| Check `shop.subscriptionTier` in components | Couples component code to tier logic. Adding a new tier requires component changes. | Check `state.capabilities.includes('key')` |
| Check `shop.businessType` in components | Couples component code to business type. Adding a new type requires component changes. | Check `state.capabilities.includes('key')` |
| Read `feature_definitions` table client-side | Server resolves capabilities at login. Client only needs the flat array. | Use `state.capabilities` only |

---

## 9. Planned Changes

| Change | Impact | Status |
|--------|--------|--------|
| Discriminated union for actions | Eliminates `payload: any`. Type-safe dispatch. | Planned (tech debt #1) |
| Split context exports to separate files | Fixes React Refresh warnings (15 warnings, 6 files). | Planned (tech debt #2) |
| Zustand or Redux Toolkit evaluation | Current useReducer pattern works but scales poorly with ~44 actions. | Not started |
