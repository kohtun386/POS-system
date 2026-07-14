# Product Requirements Document — CoffeeShop POS v1

**Status:** Draft
**Last updated:** 2026-07-14 (aligned with VISION.md v3.1.0)
**Supersedes:** Nothing (new document)
**Governs:** All v1 feature work. Every PR must reference acceptance criteria from this doc.

---

## 1. Product Overview

CoffeeShop POS is a multi-tenant, web-based point-of-sale platform for fast-paced F&B environments: coffee shops and tea shops.

**v1 focus:** High-speed retail checkout workflow. Barista adds products → cart → checkout → receipt. Under 10 seconds for a 3-item order on iPad.

**Architecture foundation (in progress):**
- Multi-tenant schema with `shop_id` foundation on tenant-scoped tables
- Role-based access control (platform_admin / admin / manager / cashier)
- 3-tier subscription model (Free / Growth / Pro) with capability-based feature flags
- Modular component structure (Manager + Modal pattern per domain)
- Supabase backend with RLS-enforced tenant isolation and pending dynamic per-shop configuration

**Future expansion (not v1):** Table management, kitchen display system (KDS), recipe/ingredient costing, supplier portals, delivery integration.

---

## 2. User Personas

### 2.1 Barista — "Moe"

| Attribute | Detail |
|-----------|--------|
| Role | `cashier` |
| Device | iPad (landscape), Android tablet, or desktop browser |
| Goal | Serve customers fast. Add items → checkout → next customer. Zero friction. |
| Context | Standing at counter. 30+ orders/hour during rush. WiFi may drop. Needs tap targets ≥44px. |
| Pain points | Slow UI, small buttons, manual price lookup, typing card numbers, no offline fallback. |
| Success metric | 3-item checkout completed in < 10 seconds. |

### 2.2 Owner — "Ko"

| Attribute | Detail |
|-----------|--------|
| Role | `admin` or `manager` |
| Device | Laptop (desktop browser), phone for quick checks |
| Goal | See revenue, manage inventory, control discounts, track staff. Data-driven decisions. |
| Context | In office or remote. Checks reports daily. Manages products/discounts weekly. |
| Pain points | No profit visibility, inventory surprises, staff misuse, no cross-shop comparison. |
| Success metric | Daily revenue report reviewed in < 30 seconds. Inventory alerts prevent stockouts. |

---

## 3. Functional Requirements

### 3.1 POS Terminal

**FR-POS-01: Add product to cart**
> As a Barista, I want to tap a product card to add it to the cart, so that I can build an order without typing.

Acceptance Criteria:
- Product grid displays all active products with image, name, price, stock level
- Tapping a product adds 1× to cart (or increments if already in cart)
- Weight-based products show weight input modal before adding
- Out-of-stock products show "Out of Stock" overlay, tap disabled
- Low-stock products (stock ≤ minStock) show amber border + "Low Stock" badge
- Products with `trackInventory: false` always allow adding (unlimited stock)
- Cart item count badge updates in real-time on header

**FR-POS-02: Manage cart**
> As a Barista, I want to adjust quantities, apply discounts, and remove items from the cart, so that I can correct mistakes before checkout.

Acceptance Criteria:
- +/- buttons adjust quantity; quantity 0 removes item
- Per-item discount input: percentage or fixed amount
- Customer selector dropdown: search by name/email/phone
- Selected customer shown with green card; removable
- Subtotal, discount, tax, and total update live on every change
- Cart persists across page refresh (localStorage)
- Cart persists across sales tab switches

**FR-POS-03: Checkout with multiple payment methods**
> As a Barista, I want to accept cash, card, digital wallets, and credit payments, so that customers can pay however they prefer.

Acceptance Criteria:
- Payment methods available: Cash, Card, KBZpay, WavePay, AYAPay, CBPay, MPU, Digital, Credit
- Cash: enter amount received, change due calculated and displayed
- Card: bank name dropdown (20 Sri Lankan banks), card number auto-detects type (Visa/Mastercard/Amex/Discover), last 4 digits stored
- Credit: requires selected customer with sufficient credit limit; credit used updated after sale
- Split payment: toggle enables multi-payment mode; add payments until sum = total
- "Complete Payment" button disabled until payment valid
- Processing spinner during sale creation

**FR-POS-04: Generate receipt**
> As a Barista, I want to show/print a receipt after checkout, so that customer gets proof of purchase.

Acceptance Criteria:
- Receipt shows: store name/logo, address, phone, email, receipt #, invoice #, date, cashier name, customer name (if selected), line items with prices, free gifts (if any), subtotal, discount breakdown, tax, total, payment method(s)
- Print button triggers browser print dialog with @media print styles (hides non-receipt UI)
- Receipt modal appears automatically after successful checkout

**FR-POS-05: Save draft sale**
> As a Barista, I want to save an incomplete sale as a draft, so that I can return to it later without losing the cart.

Acceptance Criteria:
- "Save Draft" button in cart footer
- Draft saved to Supabase with status `draft`, invoice prefix `DRAFT-`
- Draft appears in Transactions list with purple "draft" badge
- Clicking "Complete Payment" on draft loads items into checkout modal
- After completion, draft record deleted, real sale created

**FR-POS-06: Multi-tab sales**
> As a Barista, I want to switch between multiple sales tabs, so that I can serve multiple customers simultaneously.

Acceptance Criteria:
- Vertical sidebar with tab buttons (rotated "Sale 1", "Sale 2" labels)
- "+" button creates new tab
- "×" button closes tab (minimum 1 tab always exists)
- Switching tab saves current cart state to Supabase, loads target tab's cart
- Item count badge on each tab
- Tab state persists across page refresh
- Tabs are user-scoped (barista A cannot see barista B's tabs)

---

### 3.2 Inventory Management

**FR-INV-01: Manage products**
> As an Owner, I want to create, edit, and deactivate products, so that my catalog stays current.

Acceptance Criteria:
- Product Manager: searchable, filterable table with all product fields
- Product Modal: create/edit form with all fields (name, SKU, barcode, price, cost, stock, minStock, category, description, image upload, taxable, active, weight-based toggle, track-inventory toggle)
- Weight-based products: show price-per-unit + unit selector (kg/g/lb/oz/l/ml)
- Batch management: add/edit/remove batches with batch number, manufacturing date, expiry date, quantity, cost price
- Image upload: file input + drag-and-drop, base64 storage
- Delete: confirmation dialog → soft delete (active=false) or hard delete
- Only admin/manager can access (cashier redirected to POS)

**FR-INV-02: Track stock levels**
> As an Owner, I want stock to decrease automatically when sales are completed, so that inventory counts stay accurate.

Acceptance Criteria:
- On sale completion, each cart item's quantity deducted from product.stock
- Weight-based products deduct weight, not quantity
- Products with `trackInventory: false` skip stock deduction
- Stock never goes below 0 (CHECK constraint in DB)
- Low stock and out-of-stock indicators on product cards in POS grid

**FR-INV-03: View inventory reports**
> As an Owner, I want to see inventory value, low-stock alerts, and turnover ratios, so that I can make purchasing decisions.

Acceptance Criteria:
- Reports page → Inventory tab
- Stat cards: total products, low-stock count, total stock value, potential revenue
- Table: each product with current stock, min stock, stock status, cost price, selling price, stock value, sold quantity, revenue, turnover ratio, profit margin
- Sortable by stock status (out-of-stock first) or revenue
- CSV export

---

### 3.3 Customer Management

**FR-CUST-01: Manage customers**
> As an Owner, I want to create, edit, and view customer records, so that I can track purchasing behavior and manage credit.

Acceptance Criteria:
- Customer Manager: searchable table with name, email, phone, total purchases, price tier, last purchase
- Customer Modal: create/edit with name, email, phone, address, credit limit, price tier
- Customer Detail Modal: tabbed view (details + transaction history)
- Detail view shows: total spent, transaction count, average transaction value, credit available, credit usage bar
- Transaction history: all sales linked to customer, sorted by date descending

**FR-CUST-02: Customer credit system**
> As an Owner, I want to set credit limits per customer, so that trusted customers can buy on credit.

Acceptance Criteria:
- `creditLimit` and `creditUsed` fields on customer record
- Credit payment option in checkout only available when selected customer has sufficient available credit
- After credit sale: `creditUsed` incremented by sale total
- After non-credit sale with selected customer: `totalPurchases` incremented, `lastPurchase` updated
- Credit available = creditLimit - creditUsed displayed in checkout modal

---

### 3.4 Discount Engine

**FR-DISC-01: Manage discounts**
> As an Owner, I want to create automatic discounts with conditions, so that promotions apply without barista intervention.

Acceptance Criteria:
- Discount Manager: table with name, type, value, conditions, valid period, status
- Discount Modal: create/edit with name, description, type (percentage/fixed/free_gift), value, min amount, max discount, valid from/to, valid days (Sun-Sat), conditions, free gift product selection
- Active/inactive toggle (clickable badge in table)
- Expired discounts auto-deactivate (migration `20260619000001`)

**FR-DISC-02: Auto-apply discounts at checkout**
> As a Barista, I want discounts to apply automatically when conditions are met, so that I don't have to remember promotion rules.

Acceptance Criteria:
- Checkout modal checks all active discounts against cart + customer + payment method + card details
- Eligible discounts shown in green alert box with discount name and amount
- Free gifts shown with 🎁 prefix and "FREE" label
- Discount types: percentage (capped by maxDiscount), fixed amount, free_gift (adds product with $0 subtotal)
- Condition types: min_amount, specific_products (with minQuantity), payment_method, customer_tier, card_type, bank_name
- Total discount = manual per-item discounts + auto-applied discounts

---

### 3.5 Transactions

**FR-TXN-01: View transaction history**
> As an Owner, I want to view, filter, and export all sales transactions, so that I can audit revenue and investigate issues.

Acceptance Criteria:
- Transactions Manager: table with receipt #, date/time, customer, items, total, payment method, status, cashier
- Filters: search (receipt/customer/cashier), status (all/completed/pending/credit/draft/refunded), payment method, date range (today/week/month/all)
- Stat cards: total revenue, total transactions, average sale amount
- Detail modal: full sale breakdown including card details, payment splits, discount breakdown, free gifts, notes
- Draft sales: "Complete Payment" button loads draft into checkout
- CSV export with all visible columns
- Cursor-based pagination (50 per page)

---

### 3.6 Reports & Analytics

**FR-RPT-01: Sales reports**
> As an Owner, I want to see sales trends, top products, and category distribution, so that I can optimize my product mix.

Acceptance Criteria:
- Reports page → Sales tab
- Date range filter: today, 7 days, 30 days, 90 days, custom range
- Stat cards: total revenue, transactions, average sale, total discounts
- Line chart: daily sales trend + transaction count
- Pie chart: revenue by category
- Table: top 5 selling products with quantity, revenue, average price
- Export as CSV

**FR-RPT-02: Customer reports**
> As an Owner, I want to see customer spending patterns, so that I can identify VIP customers and at-risk customers.

Acceptance Criteria:
- Reports page → Customers tab
- Stat cards: total customers, active customers (30 days), average customer value, top customer
- Line chart: top 10 customer spending
- Table: customer name, total spent, transactions, items purchased, average transaction, last purchase
- Walk-in customers grouped separately

**FR-RPT-03: Inventory reports**
> As an Owner, I want to see stock status distribution and stock value by category, so that I can manage purchasing.

Acceptance Criteria:
- Reports page → Inventory tab
- Pie chart: stock status distribution (in-stock/low-stock/out-of-stock)
- Pie chart: stock value by category
- Table: product name, SKU, category, stock, status, stock value, sold, revenue, turnover ratio, profit margin

---

### 3.7 User Management

**FR-USR-01: Manage staff accounts**
> As an Owner, I want to create, edit, and deactivate staff accounts with role assignment, so that I control who can access what.

Acceptance Criteria:
- User Manager: table with name, username, email, role, last login, status
- User Modal: create/edit with name, username, email, password (create only), role (admin/manager/cashier), active toggle
- Role permissions display: each role shows its capabilities
- Self-edit prevention: cannot change own role or deactivate self
- New user creation: signUp → trigger creates profile → admin UPDATES role
- Admin session preserved during user creation (save/restore pattern)
- Only admin can access User Management

---

### 3.8 Settings

**FR-SET-01: Configure shop settings and global preferences**
> As an Owner, I want to configure shop identity, POS behavior, and system preferences, so that receipts, pricing, and staff workflows reflect my business.

Acceptance Criteria:
- Shop Configuration section persists to `shops`: store name, address, phone, email, logo upload, tax rate, display currency, base currency, invoice prefix, business type, and draft retention days
- Invoice counter is DB-owned and not user-editable from the Settings UI; invoice numbers come from the atomic database function `generate_invoice_number(p_shop_id)` which mutates `shops.invoice_counter` atomically. Only an explicit admin reset workflow (if implemented) should modify the counter.
- Global Preferences section persists to `app_settings`: interface mode, theme, receipt printer toggle, auto-backup toggle, exchange-rate provider, exchange-rate API key, and exchange-rate update interval
- Exchange-rate API key storage in `app_settings` is a known security compromise; future work moves provider keys to Edge Function secrets or server-side deployment environment variables
- Exchange rate management: view/edit rates, update from API, view history
- Current user info display
- Shop identity/POS config editable by shop admin only
- Preference fields editable by admin/manager according to RLS and UI permissions
- Changes persist through service objects, not direct component-level Supabase calls

---

### 3.9 Authentication & Authorization

**FR-AUTH-01: Email/password authentication with pending approval**
> As a user, I want to sign up and sign in with email and password, so that my identity is verified before I access the POS.

Acceptance Criteria:
- Login page: email + password + show/hide password toggle
- Sign up: email + password + name + username; self-registration creates a pending user/shop/membership workflow
- Instant active access after signup is deprecated
- If email confirmation is enabled in Supabase, unconfirmed users cannot sign in normally
- Pending users see a Pending Approval screen instead of POS access
- Access requires `users.active = true`, `shop_memberships.is_active = true`, and `shops.is_active = true`
- Sign out: confirmation dialog → clears all state → redirects to login
- Friendly error messages for: invalid credentials, email not confirmed, pending approval, too many requests, network errors
- Session persisted across page refresh (Supabase autoRefreshToken)

**FR-AUTH-02: Role-based access control**
> As an Owner, I want different roles to see different navigation items and access different features, so that baristas can't modify inventory or see financial reports.

Acceptance Criteria:
- `platform_admin`: Cross-tenant platform operator. Manages all shops, approves signups, activates subscriptions. All operations via Edge Functions with `service_role` key. No direct DB access. Desktop-first UI.
- Cashier: POS only. Navigation shows POS only. Redirected to POS if accessing other views.
- Manager: POS, Transactions, Inventory, Customers, Discounts, Reports, Settings. No User Management or Owner Insights.
- Admin: All features including User Management and Owner Insights (Pro tier).
- `shop_memberships.role` is the canonical authorization source (not `users.role`).
- RLS enforced at database level (not just UI). Cashier calling Supabase API directly cannot read/write beyond their role.
- `platform_admin` does NOT appear in RLS policies — bypasses via Edge Functions.

---

### 3.10 Multi-Tenancy (Foundation)

**FR-MT-01: Shop isolation and dynamic shop configuration**
> As a system, I need data and configuration scoped to a shop, so that multiple coffee shops can operate independently on the same platform.

Acceptance Criteria:
- `shops` table exists with default shop row and dynamic shop configuration fields
- `shop_memberships` table exists linking users to shops with per-shop roles
- Tenant-scoped tables have `shop_id UUID NOT NULL DEFAULT '<default-shop>' REFERENCES shops(id)` column
- Index on every `shop_id` FK column
- RLS policies scope queries by `shop_id` via active shop membership
- `shops` owns store identity, tax rate, currency, invoice prefix/counter, business type, and draft retention
- `app_settings` owns global/preferences-style settings only
- Invoice generation is atomic and database-owned per shop
- No UI for shop switching in this milestone
- Existing single-shop operation unchanged for default shop users after migration

---

### 3.11 Subscription Tiers

**FR-SUB-01: 3-tier subscription model**
> As a platform operator, I want shops to have subscription tiers (Free/Growth/Pro) with tier-gated features, so that the platform can monetize progressively.

Acceptance Criteria:
- Three tiers: Free (0 MMK/month), Growth (49,000 MMK/month), Pro (149,000 MMK/month)
- `shops.subscription_tier` stores current tier
- Free tier limits: max 50 products, 50 orders/day, no printer, no inventory tracking
- Growth tier: thermal printer, purchase log, stock overview, low stock alerts, cash drawer, unlimited orders
- Pro tier: + owner insights (P&L), simple profit report (Revenue − Purchases), WhatsApp daily report
- Grace period: 5 days after subscription expiry, then auto-downgrade to Free features
- Manual high-touch billing via KBZpay/AYApay/UABpay/MMQR (no automated billing)
- Tier managed by platform_admin via Platform Admin UI

### 3.12 Daily Order Limit

**FR-LIMIT-01: Server-side order limit enforcement**
> As a platform operator, I want Free tier shops limited to 50 orders/day, so that the platform can drive upgrades.

Acceptance Criteria:
- Free tier: 50 orders/day enforced server-side in the atomic checkout transaction
- Growth/Pro: unlimited orders
- Race condition protection: concurrent checkouts serialized at shop row level via database row locking
- Client-side: when server returns `DAILY_LIMIT_REACHED` error, show upgrade prompt
- Limit reset at midnight (Asia/Yangon timezone)

### 3.13 Checkout Atomicity

**FR-CHK-01: Atomic checkout via single RPC**
> As a system, I need checkout to be a single atomic transaction, so that partial failures don't leave inconsistent data.

Acceptance Criteria:
- Checkout uses `supabase.rpc('checkout_complete', ...)` — single atomic RPC call
- All steps succeed together or all roll back: sale creation, inventory deduction, kitchen order, customer stats, consumption logging
- No sequential JavaScript service calls for checkout
- Inventory deduction failure (insufficient stock) rolls back entire checkout
- Free tier: finished product stock check only (if `track_inventory` enabled)

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| POS add-to-cart response | < 100ms | Time from tap to cart update |
| Checkout completion | < 2s | Time from "Complete Payment" to receipt display |
| Page initial load | < 3s | Time to interactive on 4G connection |
| Product grid render | < 500ms | 100 products, iPad Air 4th gen |
| Report generation | < 3s | 1000 sales records, 30-day range |
| Sales list pagination | < 1s | 50 records per page |

### 4.2 Offline-First Reliability

| Behavior | Requirement |
|----------|-------------|
| Cart persistence | Cart survives page refresh, browser close, tab switch (localStorage + Supabase sales_tabs) |
| PWA installable | iOS "Add to Home Screen", Android install prompt |
| Cached UI shell | Service worker precaches all JS/CSS/HTML/icons |
| Supabase API caching | NetworkFirst strategy, 5s timeout, 5min expiry |
| Draft sales | Save incomplete transactions even without network |
| Graceful degradation | If Supabase unreachable: show cached products, queue checkout for later |

### 4.3 Data Security

| Requirement | Implementation |
|-------------|---------------|
| RLS on all tables | Every table has Row Level Security enabled |
| Role-aware policies | SELECT for all authenticated; INSERT/UPDATE/DELETE gated by role |
| Card data protection | `cardNumber` stripped from `card_details` and `payments` JSONB (migration `20260618000001`) |
| No service_role in client | Removed from JS bundle; admin ops via Edge Functions |
| Function search_path | All 8 public functions use `SET search_path = ''` |
| SECURITY DEFINER revoked | `handle_new_auth_user()`, `rls_auto_enable()` — client roles cannot invoke |
| Tenant isolation | `shop_id` FK + RLS subquery to active `shop_memberships` |
| Password policy | Supabase "Strong" setting; leaked password protection enabled |
| Pending approval | Self-signups gated until user, shop membership, and shop are active |

### 4.4 Accessibility

| Requirement | Target |
|-------------|--------|
| Touch targets | ≥ 44px (iOS HIG), ≥ 48px on coarse pointer devices |
| Color contrast | WCAG 2.1 AA (4.5:1 for text) |
| Keyboard navigation | All interactive elements focusable |
| Screen reader | Semantic HTML, ARIA labels on icon buttons |

### 4.5 Internationalization (Future)

| Requirement | Status |
|-------------|--------|
| Myanmar language | v2 — English-first for v1 (technical stability) |
| RTL support | Not needed (Myanmar is LTR) |
| Multi-currency | Not implemented (MMK only) |

---

## 5. Out of Scope (v1)

| Feature | Reason | Tier / Version |
|---------|--------|----------------|
| Supplier management UI | `suppliers` table exists but no frontend CRUD | v2 |
| Recipe/ingredient costing | Too complex for Myanmar coffee shop reality | **Removed from v1** (VISION §19) |
| Raw material tracking | Replaced by Purchase Log (Growth+) | **Removed from v1** (VISION §19) |
| Kitchen display system (KDS) | Not practical in Myanmar; use thermal printer | **Removed from v1** (VISION §19) |
| Table management | Restaurant floor plan + table assignment | v2 (restaurant/food_court business types) |
| Delivery integration | Grab/Foodpanda API integration | v3 |
| Loyalty program | Points, tiers, rewards engine | v2 |
| Multi-shop UI | Shop selector, shop management screens, invite flow | After `shop_id` migration |
| Offline checkout queue | Queue sales when offline, sync when online | Post-beta (PWA Option C) |
| Barcode scanner hardware | Software-only; hardware integration deferred | v2 |
| Thermal receipt printer | Bluetooth/Network printer support | **Growth+ tier** (Free tier: manual/no receipt) |
| USB printer support | WebUSB via Android Chrome | v2 only |
| Audit logging | `activity_log` table designed but not implemented | v2 |
| Email/SMS alert delivery | Alert tables exist in code but not in DB; no actual sending | v2 |
| Multi-language UI | react-i18next planned, not implemented | **v2 — English-first for v1** |
| Custom report builder | Fixed 3 report types only | v3 |
| Payment gateway integration | Manual card entry only; no Stripe/2C2P | v3 |
| Inventory purchase orders | No PO workflow | v3 |
| User permissions granularity | Role-based only; no per-feature permission flags | v2 |
| Myanmar language UI | English-first for technical stability | v2 |

---

## 6. Glossary

| Term | Code Enum / Field | Definition |
|------|-------------------|------------|
| **Sale** | `sales.status: 'completed'` | Finished transaction. Payment received. Inventory deducted. |
| **Draft Sale** | `sales.status: 'draft'` | Incomplete transaction saved for later. Invoice prefix `DRAFT-`. Inventory NOT deducted. |
| **Credit Sale** | `sales.status: 'credit'` | Sale paid on customer credit. `creditUsed` incremented. |
| **Split Payment** | `sales.payment_method: 'split'` | Sale paid with multiple methods. Breakdown in `sales.payments` JSONB array. |
| **Weight-Based Product** | `products.is_weight_based: true` | Priced per unit weight (kg, lb, g). Customer specifies weight at add-to-cart. Price = pricePerUnit × weight. |
| **Track Inventory** | `products.track_inventory: true` | Stock level managed. Deducted on sale. Checked before add-to-cart. If false, stock unlimited. |
| **Price Tier** | `customers.price_tier` | Customer classification: Standard, Premium, VIP, Wholesale. Used for tier-based discounts. |
| **Credit Limit** | `customers.credit_limit` | Maximum credit a customer can carry. `credit_used` tracks current balance. |
| **Credit Used** | `customers.credit_used` | Current credit balance. Decremented when credit sale paid off. |
| **Batch** | `product_batches` | Manufacturing/expiry tracking per product. Links to product via `product_id`. |
| **Discount Condition** | `discounts.conditions` (JSONB) | Rule that must be met for discount to auto-apply. Types: min_amount, specific_products, payment_method, customer_tier, card_type, bank_name. |
| **Free Gift** | `discounts.type: 'free_gift'` | Discount that adds product(s) to cart at $0. Products specified in `free_gift_products` array. |
| **Applied Discount** | `sales.applied_discounts` (JSONB) | Snapshot of discounts applied at sale time. Preserves history even if discount later deleted. |
| **Active Shop** | `shop_memberships` | Shop user is currently operating in. Determined by active membership for now; shop selector deferred. All queries scoped to this shop. |
| **Shop Membership** | `shop_memberships` | User-to-shop link with per-shop role. User can be admin at Shop A, cashier at Shop B in the long-term model. `shop_memberships.role` is the canonical authorization source. |
| **Platform Admin** | `users.role = 'platform_admin'` | Cross-tenant platform operator (Ko Htun). Manages all shops, approves signups, activates subscriptions. Operates via Edge Functions only — no direct DB access, no RLS bypass in policies. |
| **Subscription Tier** | `shops.subscription_tier` | Shop's current plan: `free`, `growth`, or `pro`. Determines feature access and limits. Managed by platform_admin. |
| **RLS** | Row Level Security | Postgres feature. Policies filter rows at query level. Supabase enforces on every API call. |
| **SECURITY DEFINER** | Function attribute | Function runs with owner privileges, bypassing RLS. Used for triggers only. Client roles revoked. |
| **Invoice Number** | `sales.invoice_number` | Formatted as `{prefix}-{counter}` (e.g., `INV-001001`). Auto-generated by DB trigger if empty. |
| **Receipt Number** | `sales.receipt_number` | Same as invoice number in current implementation. Displayed on printed receipt. |
| **Interface Mode** | `app_settings.interface_mode` | `'touch'` (larger targets, fewer columns) or `'traditional'` (compact, mouse-optimized). |

---

## 7. Acceptance Criteria Summary (Quick Reference)

| ID | Feature | Key Criteria |
|----|---------|-------------|
| FR-POS-01 | Add to cart | Tap → cart. Weight modal for weight-based. Out-of-stock blocked. |
| FR-POS-02 | Manage cart | +/- qty, per-item discount, customer select, live totals, persists on refresh. |
| FR-POS-03 | Checkout | 9 payment methods, card detection, split payments, credit validation. |
| FR-POS-04 | Receipt | Full sale details, print dialog, auto-show after checkout. |
| FR-POS-05 | Draft sale | Save incomplete, resume later, delete on completion. |
| FR-POS-06 | Multi-tab | Create/switch/close tabs, per-user isolation, persists across refresh. |
| FR-INV-01 | Products | CRUD with all fields, weight-based, batches, image upload. |
| FR-INV-02 | Stock tracking | Auto-deduct on sale, skip if trackInventory=false. |
| FR-INV-03 | Inventory reports | Value, low-stock, turnover, CSV export. |
| FR-CUST-01 | Customers | CRUD, detail view with transaction history. |
| FR-CUST-02 | Credit system | Credit limit, credit used, credit payment validation. |
| FR-DISC-01 | Discounts | CRUD with 6 condition types, valid days, free gifts. |
| FR-DISC-02 | Auto-apply | Checkout checks all active discounts, shows applied. |
| FR-TXN-01 | Transactions | List, filter, detail, draft completion, CSV export. |
| FR-RPT-01 | Sales reports | Trends, top products, categories, date range. |
| FR-RPT-02 | Customer reports | Spending patterns, top customers. |
| FR-RPT-03 | Inventory reports | Stock status, value by category. |
| FR-USR-01 | User management | CRUD with roles, self-edit prevention, admin-only. |
| FR-SET-01 | Settings | Shop config in `shops`; global preferences/exchange settings in `app_settings`. |
| FR-AUTH-01 | Auth | Email/password, pending approval, sign up/in/out, friendly errors. |
| FR-AUTH-02 | RBAC | 4 roles (platform_admin/admin/manager/cashier), role-based nav + RLS enforcement. |
| FR-MT-01 | Multi-tenancy | shop_id foundation, dynamic shop config, DB-owned invoices, no shop switching UI yet. |
| FR-SUB-01 | Subscription tiers | 3-tier model (Free/Growth/Pro), tier-gated features, 5-day grace period, manual billing. |
| FR-LIMIT-01 | Daily order limit | 50/day Free, server-side enforcement, race condition protection, upgrade prompt. |
| FR-CHK-01 | Checkout atomicity | Single RPC (`checkout_complete`), all-or-nothing transaction, no sequential JS calls. |
