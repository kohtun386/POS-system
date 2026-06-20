# State Management Architecture — CoffeeShop POS

**Last updated:** 2026-06-19
**Source of truth:** `src/context/SupabaseAppContext.tsx` (active), `src/context/AuthContext.tsx`, `src/context/ThemeContext.tsx`, `src/context/CurrencyContext.tsx`

---

## 1. Provider Tree

```
<ThemeProvider>                    — theme state (light/dark/system)
  <AuthProvider>                   — Supabase auth session + user profile
    <AppProvider>                  — ALL app state (products, cart, sales, etc.)
      <CurrencyProvider>           — Multi-currency + exchange rates
        <AppContent />             — Routes + header
      </CurrencyProvider>
    </AppProvider>
  </AuthProvider>
</ThemeProvider>
```

Defined in `src/App.tsx`.

**Rule:** Providers must wrap in this exact order. `AppProvider` depends on `useAuth()`. `CurrencyProvider` depends on nothing from `AppProvider` but logically sits inside it.

---

## 2. Context Inventory

| Context | File | State Type | Key Exports |
|---------|------|-----------|-------------|
| `ThemeContext` | `src/context/ThemeContext.tsx` | `useState` | `isDark`, `toggleTheme`, `setTheme`, `theme` |
| `AuthContext` | `src/context/AuthContext.tsx` | `useState` × 4 | `user`, `profile`, `session`, `loading`, `signIn`, `signUp`, `signOut`, `updateProfile` |
| `AppContext` (active) | `src/context/SupabaseAppContext.tsx` | `useReducer` | `state`, `dispatch` |
| `CurrencyContext` | `src/context/CurrencyContext.tsx` | `useReducer` | `state`, `loadSupportedCurrencies`, `convertAmount`, `formatAmount`, `updateExchangeRates`, etc. |
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
  settings: AppSettings;
  selectedCustomer: Customer | null;
  salesTabs: SalesTab[];
  activeSalesTab: string;
  activeShopId: string;  // Current shop for multi-tenant scoping
  loading: boolean;
  error: string | null;
}
```

### 3.2 Action Types (25 actions)

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
| `SET_SETTINGS` | `Partial<AppSettings>` | Merge into settings |
| `INCREMENT_INVOICE_COUNTER` | `number` | Set new counter value |
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
const [products, customers, sales, discounts, settings, users, salesTabs] = await Promise.all([
  productsService.getAll(),
  customersService.getAll(),
  salesService.getAll().then(r => r.data),
  discountsService.getAll(),
  settingsService.get(),
  usersService.getAll(),
  salesTabsService.getByUserId(user.id)
]);
```

All 7 queries run in parallel. If any fail, error dispatched. On logout, all state reset to initial.

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
| `useInvoiceGeneration()` | Returns async function that generates invoice number AND persists counter to Supabase. |
| `useInvoiceStats()` | Returns function that computes invoice statistics from current state. |
| `getActiveShopId(state)` | Returns `state.activeShopId`. For future service layer injection. |
| `useActiveShopId()` | Hook returning active shop ID from context. For future service layer injection. |

### 3.6 Exported Utility Functions

| Function | Purpose |
|----------|---------|
| `checkDiscountEligibility(discount, cart, customer, paymentMethod, total, cardDetails?)` | Returns boolean. Checks active, date range, valid days, all conditions. |
| `getNextInvoiceNumber(settings)` | Returns formatted string `PREFIX-000001`. |
| `generateNextInvoiceNumber(settings)` | Returns `{ invoiceNumber, newCounter }`. |
| `resetInvoiceCounter(dispatch, newCounter)` | Dispatch counter update. |
| `setInvoicePrefix(dispatch, prefix)` | Dispatch prefix update. |

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

Sign up → `supabase.auth.signUp()` → DB trigger `handle_new_auth_user()` creates profile → frontend fetches trigger-created row → sets profile.

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

## 6. CurrencyContext

### 6.1 State Shape

```typescript
interface CurrencyState {
  supportedCurrencies: CurrencyConfig[];
  baseCurrency: CurrencyConfig | null;
  displayCurrency: string;
  exchangeRates: ExchangeRate[];
  isLoading: boolean;
  error: string | null;
  lastUpdateTime: Date | null;
}
```

### 6.2 Behavior

- Loads supported currencies from `currency_config` table on mount
- Loads base currency from `CurrencyUtils.getBaseCurrency()`
- Loads exchange rates when base currency set
- Background auto-update DISABLED (commented out). Manual updates only via Settings.
- 5-minute in-memory cache on exchange rates (`CurrencyUtils.cachedRates`)

### 6.3 Exported Hooks

| Hook | Purpose |
|------|---------|
| `useCurrency()` | Full context access |
| `useCurrencyFormat()` | Returns `{ format, displayCurrency }` |
| `useCurrencyConversion()` | Returns `{ convert, getRate, baseCurrency, displayCurrency }` |

---

## 7. Component → State Access Patterns

### 7.1 POS Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `POSTerminal` | `state.cart`, `state.activeSalesTab`, `state.currentUser`, `state.settings` | `ADD_TO_CART`, `UPDATE_CART_ITEM`, `UPDATE_SALES_TAB`, `CLEAR_CART` |
| `ProductGrid` | `state.products`, `state.settings` | — |
| `Cart` | `state.cart`, `state.selectedCustomer`, `state.customers`, `state.settings` | `UPDATE_CART_ITEM`, `REMOVE_FROM_CART`, `SET_SELECTED_CUSTOMER` |
| `CheckoutModal` | `state.cart`, `state.selectedCustomer`, `state.discounts`, `state.products`, `state.settings`, `state.currentUser` | `ADD_SALE`, `UPDATE_PRODUCT`, `UPDATE_CUSTOMER`, `CLEAR_CART`, `INCREMENT_INVOICE_COUNTER` |
| `SalesTabManager` | `state.salesTabs`, `state.activeSalesTab`, `state.cart`, `state.selectedCustomer` | `ADD_SALES_TAB`, `UPDATE_SALES_TAB`, `REMOVE_SALES_TAB`, `SET_ACTIVE_SALES_TAB` |

### 7.2 Management Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `InventoryManager` | `state.products` | — |
| `ProductModal` | — | `ADD_PRODUCT`, `UPDATE_PRODUCT` |
| `CustomerManager` | `state.customers` | `DELETE_CUSTOMER` |
| `CustomerModal` | — | `ADD_CUSTOMER`, `UPDATE_CUSTOMER` |
| `DiscountManager` | `state.discounts` | `DELETE_DISCOUNT` |
| `DiscountModal` | `state.products` (for free gift selection) | `ADD_DISCOUNT`, `UPDATE_DISCOUNT` |
| `TransactionsManager` | `state.sales`, `state.settings` | — |
| `ReportsManager` | `state.sales`, `state.products`, `state.customers`, `state.settings` | — |
| `UserManager` | `state.users`, `state.currentUser` | `SET_USERS` |
| `UserModal` | `state.users`, `state.currentUser` | `SET_USERS` |
| `Settings` | `state.settings`, `state.currentUser` | `SET_SETTINGS` |

### 7.3 Layout Components

| Component | Reads | Dispatches |
|-----------|-------|------------|
| `Header` | `state.currentUser`, `state.settings`, `state.cart` | `SET_SETTINGS` (interface mode toggle) |
| `LoginPage` | — | — (uses `useAuth()` only) |

---

## 8. State Flow Diagrams

### 8.1 Checkout Flow

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
  │   generateInvoice() → settingsService.update() + dispatch INCREMENT_INVOICE_COUNTER
  │   │
  │   ▼
  │   salesService.create(sale) → dispatch ADD_SALE
  │   │
  │   ▼
  │   For each cart item with trackInventory:
  │     productsService.update(id, { stock: stock - quantity }) → dispatch UPDATE_PRODUCT
  │   │
  │   ▼
  │   If customer selected:
  │     customersService.update(id, { creditUsed, totalPurchases, lastPurchase }) → dispatch UPDATE_CUSTOMER
  │   │
  │   ▼
  │   dispatch CLEAR_CART
  │   │
  │   ▼
  │   setShowReceipt(true) → ReceiptPrint modal
  │
  ▼
onComplete(sale) → POSTerminal clears tab cart
```

### 8.2 Sales Tab Switch Flow

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

### 8.3 Auth State Change Flow

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
  │   Promise.all([products, customers, sales, discounts, settings, users, salesTabs])
  │   dispatch all → state populated
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
  │     setInitialized(false)
```

---

## 9. Anti-Patterns (What NOT To Do)

| Anti-Pattern | Why | Correct Pattern |
|-------------|-----|-----------------|
| Import from `AppContext.tsx` | Deprecated. Uses localStorage mock data. | Import from `SupabaseAppContext.tsx` |
| Call `supabase.from()` in components | Bypasses service layer. No camelCase↔snake_case mapping. | Use service objects from `src/lib/services.ts` |
| Mutate `state` directly | Breaks React rendering. Reducer won't fire. | Always `dispatch()` |
| Duplicate stock deduction logic | `CheckoutModal` already handles it. Double-deduct = negative stock. | Let CheckoutModal handle inventory. |
| Build invoice number manually | `useInvoiceGeneration()` handles prefix + counter + Supabase persist. | Use `useInvoiceGeneration()` hook. |
| Reimplement discount eligibility | `checkDiscountEligibility()` handles all 6 condition types. | Use exported utility function. |
| `any` type in reducer payloads | Loses type safety. 73 lint errors already. | Use discriminated union (planned cleanup). |

---

## 10. Planned Changes

| Change | Impact | Status |
|--------|--------|--------|
| `shopId` in AppState | All queries scoped by shop. `activeShopId` field added. | Planned (shop_id migration) |
| Discriminated union for actions | Eliminates `payload: any`. Type-safe dispatch. | Planned (tech debt #1) |
| Split context exports to separate files | Fixes React Refresh warnings (26 warnings, 6 files). | Planned (tech debt #2) |
| Zustand or Redux Toolkit evaluation | Current useReducer pattern works but scales poorly with 25 actions. | Not started |
