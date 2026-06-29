# Coding Conventions & Patterns — CoffeeShop POS

**Last updated:** 2026-06-29 (aligned with VISION.md v3.0.0)

Synthesized from existing documentation. Each pattern links to its source.

---

## Component Structure

### Naming & File Organization

- **PascalCase** for component names: `ProductGrid`, `CheckoutModal`, `CustomerManager`
- **One component per file**, named export (never default export inside `src/components/`)
- **Props interface** defined above the component
- **Domain grouping:** `src/components/<domain>/` — each domain has a Manager (table/list view) and Modal sub-components (forms)
- **Reusable UI primitives** in `src/components/ui/` (Button, Card, Input, CurrencyDisplay, LoadingComponents)

**Source:** `CLAUDE.md`

### Manager/Modal Pattern

Every CRUD domain follows the same structure:

```
src/components/<domain>/
  <Domain>Manager.tsx    — table/list view with search, filters, stats cards, add/edit/delete actions
  <Domain>Modal.tsx      — form modal for create/edit, local form state, validation, service call
```

**Domains using this pattern:** inventory (InventoryManager + ProductModal), customers (CustomerManager + CustomerModal), discounts (DiscountManager + DiscountModal), users (UserManager + UserModal), alerts (AlertManager + RecipientModal + TemplateModal + ServiceModal)

**Source:** `CLAUDE.md`, `docs/specs/prd.md`

### Modal Structure

```tsx
<div className="modal-overlay">
  <div className="modal max-w-...">
    <div className="modal-header">
      <h2>Title</h2>
      <button onClick={onClose}>×</button>
    </div>
    <div className="modal-body">
      {/* form fields */}
    </div>
    <div className="modal-footer">
      <button className="btn btn-secondary btn-md">Cancel</button>
      <button className="btn btn-primary btn-md">Save</button>
    </div>
  </div>
</div>
```

**Source:** `CLAUDE.md`, `src/index.css`

### Touch Mode

Check `state.settings.interfaceMode === 'touch'` and apply `.touch-friendly` class for larger tap targets. Touch mode uses `btn-lg` and `h-14 text-lg` inputs.

**Source:** `CLAUDE.md`

---

## Service Layer Pattern

### Structure

All DB access through service objects in `src/lib/services.ts`. Never call `supabase.from()` directly in components.

```ts
export const productsService = {
  async getAll(): Promise<Product[]> { ... },
  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> { ... },
  async update(id: string, product: Partial<Product>): Promise<Product> { ... },
  async delete(id: string): Promise<void> { ... }
}
```

### camelCase ↔ snake_case Mapping

Every service method maps between frontend camelCase and DB snake_case:

```ts
// Read: DB → Frontend
minStock: product.min_stock || 0,
isWeightBased: product.is_weight_based ?? false,
createdAt: new Date(product.created_at)

// Write: Frontend → DB
min_stock: product.minStock,
is_weight_based: product.isWeightBased,
```

### Services Inventory

| Service | Table | Notes |
|---------|-------|-------|
| `productsService` | products | Lazy-loads batches via `getBatchesByProductId()` |
| `customersService` | customers | `update()` only includes provided fields |
| `salesService` | sales | Cursor-based pagination: `{ limit, cursor } → { data, count, hasMore }` |
| `discountsService` | discounts | JSONB conditions, free_gift_products array |
| `shopsService` | shops | Business identity and per-shop POS behavior: name, logo, tax, currency, invoice config, draft retention |
| `settingsService` | app_settings | Global/preferences-style settings only: interface mode, theme, printer, backup, exchange-rate config |
| `usersService` | users | CRUD only, auth handled separately |
| `salesTabsService` | sales_tabs | User-scoped, joins customers for selected_customer |
| `alertRecipientsService` | alert_recipients | alert_types JSONB array |
| `alertTemplatesService` | alert_templates | Template body with {{variable}} placeholders |
| `alertConfigurationsService` | alert_configurations | Update only (no create/delete) |
| `alertHistoryService` | alert_history | Read-only (getAll, getByProduct) |
| `notificationServiceConfigService` | notification_service_config | configData JSONB |

### Platform Admin Service Pattern

Platform admin operations MUST use `supabase.functions.invoke()` — never `supabase.from()`. This ensures the `service_role` key stays server-side in Edge Functions and RLS policies remain clean.

```ts
// ✅ Correct — platform admin via Edge Function
const { data, error } = await supabase.functions.invoke('platform-admin-approve-shop', {
  body: { shopId, userId }
});

// ❌ Wrong — direct DB access bypasses the security model
await supabase.from('shops').update({ is_active: true }).eq('id', shopId);
```

Edge Function inventory: `platform-admin-approve-shop`, `platform-admin-reject-shop`, `platform-admin-update-subscription`, `platform-admin-list-shops`, `platform-admin-get-shop-detail`, `platform-admin-manage-features`, `platform-admin-daily-stats`.

**Source:** `docs/vision/VISION.md` §17

**Source:** `CLAUDE.md`, `src/lib/services.ts`

---

## State Update Pattern

### Dispatch, Never Mutate

```tsx
const { state, dispatch } = useApp();

// ✅ Correct
dispatch({ type: 'ADD_PRODUCT', payload: newProduct });

// ❌ Wrong
state.products.push(newProduct);
```

### Action Types by Domain

| Domain | Actions |
|--------|---------|
| Products | `SET_PRODUCTS`, `ADD_PRODUCT`, `UPDATE_PRODUCT`, `DELETE_PRODUCT` |
| Customers | `SET_CUSTOMERS`, `ADD_CUSTOMER`, `UPDATE_CUSTOMER`, `DELETE_CUSTOMER` |
| Cart | `SET_CART`, `ADD_TO_CART`, `UPDATE_CART_ITEM`, `REMOVE_FROM_CART`, `CLEAR_CART` |
| Sales | `SET_SALES`, `ADD_SALE`, `DELETE_SALE` |
| Discounts | `SET_DISCOUNTS`, `ADD_DISCOUNT`, `UPDATE_DISCOUNT`, `DELETE_DISCOUNT` |
| Users | `SET_USERS` (direct replace, no per-user actions) |
| Settings | `SET_SETTINGS` (preferences only), `SET_SHOP` (business/POS config) |
| Sales Tabs | `SET_SALES_TABS`, `ADD_SALES_TAB`, `UPDATE_SALES_TAB`, `REMOVE_SALES_TAB`, `SET_ACTIVE_SALES_TAB` |
| Meta | `SET_LOADING`, `SET_ERROR`, `SET_CURRENT_USER`, `SET_SELECTED_CUSTOMER`, `SET_ACTIVE_SHOP` |

**Source:** `docs/architecture/state-management.md`

### Cart Persistence

Cart auto-saved to `localStorage` under `CART_STORAGE_KEY = 'coffeepos_cart'` on every change. Restored on mount before Supabase load. Also persisted to `sales_tabs` table for cross-device continuity. Cleanup of stale DB cart backup data is safe because localStorage is the primary active-session persistence path.

**Source:** `docs/architecture/state-management.md`

---

## RLS Policy Patterns

All policies include `shop_id IN (SELECT public.current_shop_ids())` scoping.

**Authorization source of truth:** `shop_memberships.role` is the canonical source for shop-level authorization. `users.role` is retained temporarily for backward compatibility.

**platform_admin:** Does NOT appear in RLS policies. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions. See `docs/vision/VISION.md` §4.3.

### Pattern 1: Standard (Most Tables)

```sql
-- SELECT: all shop members
CREATE POLICY "... viewable by shop members" ON <table>
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- ALL (INSERT/UPDATE/DELETE): admin/manager only
CREATE POLICY "... write by shop admin/manager" ON <table>
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );
```

**Note:** The `users.role` check above is legacy. Long-term target is to check `shop_memberships.role` instead. Platform admin operations bypass these policies via Edge Functions.

**Used by:** app_settings, categories, suppliers, product_batches, discounts, currency tables, alert tables

### Pattern 2: Per-Operation (Products, Customers)

Separate INSERT, UPDATE, DELETE policies for finer control. Same role gating as standard.

### Pattern 3: Sales with Cashier INSERT

```sql
-- SELECT: shop members
-- INSERT: all authenticated (cashiers can create sales)
-- UPDATE/DELETE: admin/manager only
```

### Pattern 4: User-Scoped (Sales Tabs)

```sql
-- ALL operations: user_id = auth.uid()
-- Complete per-user isolation
```

### Pattern 5: Self-Profile (Users)

```sql
-- SELECT: all authenticated
-- INSERT: auth.uid() = id (own profile only, via trigger)
-- UPDATE: auth.uid() = id (self) OR admin role
-- DELETE: no policy (not allowed)
```

**Source:** `docs/architecture/auth.md`

---

## Auth Flow Patterns

### Sign-Up: DB Trigger Creates Pending Profile

Frontend calls `supabase.auth.signUp()`. DB trigger `handle_new_auth_user()` creates a pending profile/shop/membership skeleton for self-registration. Instant active access is deprecated: the user sees Pending Approval until `users.active`, `shop_memberships.is_active`, and `shops.is_active` are true. Never INSERT into `users` directly from components.

**Pending Approval Flow:**
1. User signs up → Supabase Auth creates auth user
2. DB trigger creates inactive user profile, shop, and membership
3. User signs in after email verification → app shows "Your shop is pending approval"
4. Platform admin reviews in Platform Admin UI → Approve or Reject
5. Approval: Edge Function activates user, membership, and shop; sets subscription to Free tier
6. Rejection: Edge Function sends rejection email with reason

**Rule:** No instant access. All signups require manual approval by `platform_admin`.

**Source:** `docs/architecture/auth.md`, `docs/vision/VISION.md` §6.3

### Admin Create User: Session Save/Restore

```ts
const { data: { session: adminSession } } = await supabase.auth.getSession();
const { data: authData } = await supabase.auth.signUp({ email, password, ... });
await supabase.auth.setSession(adminSession);  // restore admin session
await supabase.from('users').update({ role, name, ... }).eq('id', newUserId);
```

**Why:** `signUp()` replaces the current session. Must save/restore to keep admin logged in.

**Source:** `docs/architecture/auth.md`

### Profile Loading on Auth State Change

```ts
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) loadProfile(session.user.id);
  else { setProfile(null); setLoading(false); }
});
```

**Source:** `src/context/AuthContext.tsx`

---

## Error Handling Pattern

### SweetAlert2 for All User-Facing Messages

```ts
swalConfig.success('Product added successfully!');
swalConfig.error('Failed to save. Please try again.');
swalConfig.warning('Please enter a product name');
swalConfig.loading('Saving...');
swalConfig.deleteConfirm('product');  // confirmation before destructive ops
swalConfig.close();  // dismiss loading
```

### Try/Catch Around All Supabase Calls

```ts
try {
  swalConfig.loading('Deleting product...');
  await productsService.delete(productId);
  dispatch({ type: 'DELETE_PRODUCT', payload: productId });
  swalConfig.success('Product deleted!');
} catch (error) {
  console.error('Error deleting product:', error);
  swalConfig.error('Failed to delete. Please try again.');
}
```

### Loading State

Components use local `loading` state or `state.loading` from context. Buttons disabled during processing. Spinners shown during async operations.

**Source:** `CLAUDE.md`, `src/lib/sweetAlert.ts`

---

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| Components | PascalCase | `ProductGrid`, `CheckoutModal` |
| Callbacks/handlers | `handle` prefix | `handleAddToCart`, `handleCheckout`, `handleSubmit` |
| Service objects | camelCase + `Service` suffix | `productsService`, `salesService` |
| Context exports | PascalCase Provider, `use` prefix hook | `AppProvider`, `useApp`, `useAuth` |
| Types/interfaces | PascalCase | `Product`, `CartItem`, `AppSettings` |
| DB columns | snake_case | `min_stock`, `is_weight_based`, `created_at` |
| TS fields | camelCase | `minStock`, `isWeightBased`, `createdAt` |
| CSS classes | Tailwind utilities + custom component classes | `.btn-primary`, `.modal-overlay` |

**Source:** `CLAUDE.md`

---

## Invoice Number Generation

Use `useInvoiceGeneration()` from SupabaseAppContext, not manual string construction. The hook must call the DB-owned atomic invoice generation path for the active shop. Frontend-side counter increments are prohibited because concurrent checkouts can generate duplicate invoices.

```ts
const generateInvoice = useInvoiceGeneration();
const invoiceNumber = await generateInvoice();  // async — DB function owns counter mutation
```

**Source:** `CLAUDE.md`

---

## Checkout Atomicity Pattern

Checkout MUST use a single atomic RPC call — no sequential JavaScript service calls.

```ts
// ✅ Correct — atomic RPC
const { data, error } = await supabase.rpc('checkout_complete', {
  p_shop_id: shopId,
  p_items: cartItems,
  p_payment_method: paymentMethod,
  // ... other params
});

// ❌ Wrong — sequential calls leave inconsistent state on partial failure
await salesService.create(saleData);
await productsService.updateStock(items);
await customersService.updateStats(customerId, total);
```

**Why:** If step 2 fails after step 1 commits, the database is left in an inconsistent state. The atomic RPC wraps all steps (sale creation, inventory deduction, kitchen order, customer stats, consumption logging) in a single database transaction.

**Source:** `docs/vision/VISION.md` §11

---

## Capability-Based Feature Flags

The server resolves all feature logic. The client receives a flat list of capability strings. No tier/type conditionals exist in component code.

```ts
// ✅ Correct — check capabilities array
if (capabilities.includes('printer_integration')) { /* show printer UI */ }
if (capabilities.includes('recipe_bom')) { /* show recipe tab */ }

// ❌ Wrong — checking tier/type directly in components
if (shop.subscriptionTier === 'growth') { /* ... */ }
if (shop.businessType === 'coffee_shop') { /* ... */ }
```

**Resolution flow:** At login, server reads shop's subscription tier, business type, and per-shop overrides → resolves into `capabilities: string[]` → returns to client.

**Two gates (server-side only):**
1. Subscription tier — features below shop's tier level are disabled
2. Business type defaults — different types get different default capability sets

**Source:** `docs/vision/VISION.md` §5

---

## Discount Eligibility

Use `checkDiscountEligibility()` from SupabaseAppContext. Don't reimplement condition checking. Supports 6 condition types: `min_amount`, `specific_products` (with `minQuantity`), `payment_method`, `customer_tier`, `card_type`, `bank_name`.

**Source:** `CLAUDE.md`

---

## Anti-Patterns

| Anti-Pattern | Why | Do Instead |
|-------------|-----|------------|
| Import from `AppContext.tsx` | Deprecated, localStorage mock data | Import from `SupabaseAppContext.tsx` |
| `supabase.from()` in components | Bypasses service layer mapping | Use service objects |
| Mutate `state` directly | Breaks React state model | Use `dispatch()` |
| Forget camelCase↔snake_case mapping | Data silently wrong | Map in service methods |
| Duplicate inventory deduction logic | CheckoutModal already handles it | Don't re-deduct stock |
| Manual invoice number construction | Can desync or duplicate counters under concurrency | Use DB-backed `useInvoiceGeneration()` |
| Reimplement discount checking | Edge cases not covered | Use `checkDiscountEligibility()` |

**Source:** `CLAUDE.md`, `docs/architecture/state-management.md`

---

## CSS & Design System

### Component Classes (defined in `src/index.css`)

- `.card`, `.card-glass`, `.card-hover` — container components
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-success`, `.btn-danger`, `.btn-ghost` — buttons
- `.btn-sm`, `.btn-md`, `.btn-lg` — button sizes
- `.input`, `.input-sm`, `.select`, `.textarea` — form elements
- `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`, `.modal-footer` — modals
- `.table`, `.table-header`, `.table-row`, `.table-cell`, `.table-header-cell` — tables
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-accent` — status badges
- `.stat-card`, `.stat-card-success`, `.stat-card-warning`, `.stat-card-danger` — dashboard stats

### Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary-600` | `#9a693a` | `#b8854a` | Buttons, links, nav |
| `primary-700` | `#7a4f2c` | `#9a693a` | Button hover |
| `secondary-100` | `#f0ece5` | `#3b2613` | Cards, backgrounds |
| `secondary-200` | `#ded7cc` | `#54463b` | Borders |
| `accent-500` | `#f57323` | `#f57323` | Highlights, badges |

### Typography

- Headings: `Fraunces` (serif, 600 weight, `font-fraunces`)
- Body: `DM Sans` (sans-serif, default)

### Animations

Use `motion.div` / `motion.button` with `whileHover`, `whileTap`, `animate`, `initial` props. Keep `transition={{ duration: 0.2 }}` consistent.

**Source:** `CLAUDE.md`, `docs/architecture/design-system.md`, `src/index.css`
