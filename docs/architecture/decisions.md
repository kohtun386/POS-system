# Key Technology Decisions — CoffeeShop POS

Synthesized from existing documentation and VISION.md v3.1.0. Each decision links to its source.

**Last updated:** 2026-07-10 (aligned with VISION.md v3.1.0 — scope reframe)

---

## Stack Choices

### Frontend: React 18.3 + TypeScript 5.5 (strict) + Vite

**What:** React SPA with strict TypeScript, Vite bundler, no framework (no Next.js/Remix).

**Why:** Lightweight POS terminal doesn't need SSR. Vite offers fast HMR and build. Strict TS catches category/sku/type errors at compile time. Team familiar with React.

**Source:** `CLAUDE.md`

### Backend: Supabase (BaaS)

**What:** Supabase for auth, database (Postgres), real-time, and storage. No custom backend server.

**Why:** Eliminates server maintenance. Built-in auth, RLS, and Postgres. Row Level Security provides per-table access control without custom middleware. Edge Functions available for admin operations that need service_role key.

**Source:** `CLAUDE.md`, `docs/architecture/deployment.md`

### Styling: Tailwind CSS 3.4 with Espresso & Copper Theme

**What:** Tailwind utility-first CSS with a custom warm brown/copper color palette. No component library (no MUI/Chakra).

**Why:** Custom POS UI needs full design control. Tailwind's utility classes map directly to the design system tokens. Custom palette gives the coffee shop brand identity. Dark mode via `class` strategy.

**Source:** `CLAUDE.md`, `docs/architecture/design-system.md`

### Animations: Framer Motion

**What:** Framer Motion for component animations (whileHover, whileTap, AnimatePresence for cart items).

**Why:** Declarative React animation API. Cart item enter/exit, modal transitions, and micro-interactions without manual CSS keyframes.

**Source:** `CLAUDE.md`

### Charts: Recharts

**What:** Recharts for sales/inventory/customer reports (LineChart, PieChart).

**Why:** React-native chart library. Adequate for POS reporting needs. No heavy BI tooling required.

**Source:** `CLAUDE.md`

### Notifications: SweetAlert2

**What:** SweetAlert2 for all user-facing toasts and confirmation dialogs. Custom-themed to match Espresso & Copper palette.

**Why:** Rich toast API (success/error/warning/loading/confirm). Custom CSS classes for brand consistency. Replaces raw browser alerts.

**Source:** `CLAUDE.md`, `src/lib/sweetAlert.ts`

---

## Architecture Decisions

### State Management: useReducer (not Redux/Zustand)

**What:** Single `useReducer` in `SupabaseAppContext.tsx` holds all app state. 54 action types. No external state library.

**Why:** App complexity doesn't justify Redux overhead. useReducer provides predictable state transitions with dispatch. Cart, products, customers, sales, users, discounts, settings, and sales tabs all in one reducer. Simpler mental model for a small team.

**Source:** `docs/architecture/state-management.md`

### Service Layer Pattern (not direct Supabase calls)

**What:** 24 service objects in `src/lib/services.ts`. All DB access through services, never `supabase.from()` in components.

**Why:** Centralizes camelCase ↔ snake_case mapping. Single place to change query logic. Components stay focused on UI. Services are testable independently.

**Source:** `CLAUDE.md`

### Lazy-Loaded Route Components

**What:** All view components (POSTerminal, TransactionsManager, InventoryManager, etc.) lazy-loaded via `React.lazy()` + `Suspense`.

**Why:** POS terminal is the primary view — other views (reports, settings, user management) shouldn't block initial load. Code-splitting reduces initial bundle size.

**Source:** `src/App.tsx`

### Provider Tree Hierarchy

**What:** `ThemeProvider → AuthProvider → AppProvider → AppContent`

**Why:** AppProvider depends on `useAuth()`. Theme wraps everything for dark mode support. CurrencyProvider was removed — MMK-only formatting is a simple utility, no context needed.

**Source:** `docs/architecture/state-management.md`

### Feature Flag Architecture: Capability-Based (not Conditional)

**What:** Server resolves all feature logic at login time. Client receives a flat `capabilities: string[]` array. Components check `capabilities.includes('printer_integration')` — never check `shop.subscriptionTier` or `shop.businessType` directly.

**Why:** Decouples component code from tier/type logic. Adding a new tier or business type requires zero component changes — only server-side resolution updates. Feature definitions table (`feature_definitions`) + per-shop overrides (`shop_features`) give full flexibility.

**Resolution flow:**
1. Login → server reads shop's subscription_tier, business_type, shop_features
2. Resolves final capability list (e.g., `['pos', 'inventory', 'printer_integration']`)
3. Returns to client as flat string array
4. Components check capabilities only

**Two gates (server-side only):**
- Gate 1: Subscription tier — features below shop's tier are disabled
- Gate 2: Business type defaults — different business types get different default capability sets

**Source:** `VISION.md v3.1.0 Section 5`, `docs/architecture/database.md` (feature_definitions, shop_features tables)

---

## Database Decisions

### Row Level Security on All Tables

**What:** Every table has RLS enabled. Policies grant access based on role and shop membership.

**Why:** Supabase exposes Postgres directly to the client via PostgREST. Without RLS, any authenticated user could read/write any row. RLS is the primary security boundary.

**`platform_admin` rule:** NEVER appears in RLS policies. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions. No `OR users.role = 'platform_admin'` in any policy.

**Source:** `docs/architecture/auth.md`, `VISION.md v3.1.0 Section 4.3`

### JSONB for Flexible Fields

**What:** `items`, `payments`, `card_details`, `applied_discounts`, `free_gifts`, `conditions`, `config_data` stored as JSONB columns.

**Why:** Sale items and payment breakdowns have variable structure. JSONB avoids complex join tables for nested data. Typed at the application layer via TypeScript interfaces.

**Source:** `CLAUDE.md`, `docs/architecture/database.md`

### shop_id on All Tables from Day One (ADR-003)

**What:** `shop_id UUID NOT NULL` column added to all 13 existing tables with a hardcoded default shop UUID. `shops` and `shop_memberships` tables created. No UI yet.

**Why:** Cost of adding later is 5-10x higher — production data backfill, 51+ RLS policy rewrites, service layer breaking changes, index creation on large tables. Adding now is a single migration with zero behavior change.

**Source:** `docs/architecture/adr/003-shop-id-placeholder-now.md`

### snake_case in DB ↔ camelCase in TypeScript

**What:** All Postgres columns use `snake_case`. All TypeScript interfaces use `camelCase`. Service layer handles the mapping in both directions.

**Why:** Postgres convention is snake_case. JavaScript/TypeScript convention is camelCase. Mapping in services keeps both layers idiomatic.

**Source:** `CLAUDE.md`

### Dates as TIMESTAMP WITH TIME ZONE

**What:** All date columns are `TIMESTAMP WITH TIME ZONE`. Hydrated to `new Date()` in services.

**Why:** Timezone-aware storage prevents ambiguity. Frontend converts to local time for display.

**Source:** `CLAUDE.md`

### Timezone: Asia/Yangon (Locked)

**What:** Database timezone set to `Asia/Yangon` via `ALTER DATABASE SET timezone = 'Asia/Yangon'`. All `CURRENT_DATE`, `now()`, and `timestamptz` operations use this timezone.

**Why:** Myanmar market. Daily order limit enforcement uses `CURRENT_DATE` which must resolve to Asia/Yangon midnight, not UTC. Prevents off-by-one-day errors for shops operating near midnight.

**Source:** `VISION.md v3.1.0 Section 14`, `docs/architecture/database.md Section 8.1`

### Business Type: coffee_shop Only (v1)

**What:** `shops.business_type` CHECK constraint allows `'coffee_shop'` only. Restaurant and food_court are v2 planned types. Pharmacy, retail, supermarket are permanently excluded.

**Why:** Coffee/tea shops have a simple counter workflow. Restaurant (table service) and food court (multi-vendor) require fundamentally different UI and routing. Building for one type first ensures quality before expanding.

**Source:** `VISION.md v3.1.0 Section 2`, `docs/architecture/database.md` (shops.business_type CHECK)

### Subscription Tiers: 3-Tier (Free/Growth/Pro)

**What:** `shops.subscription_tier` CHECK constraint: `'free'` | `'growth'` | `'pro'`. Enterprise tier removed.

**Why:**
- **Free (0 MMK):** Small shops, trial users. 50 orders/day, 50 products max, no printer.
- **Growth (49,000 MMK):** Mid-size shops. Unlimited orders, printer support, purchase log, stock overview, low stock alerts, cash drawer.
- **Pro (149,000 MMK):** High-volume shops. Owner insights (P&L), simple profit report, WhatsApp daily report.

Manual high-touch billing. Customer pays via KBZpay/AYApay/UABpay/MMQR, Ko Htun activates in Platform Admin.

**Source:** `VISION.md v3.1.0 Section 3`, `docs/architecture/database.md` (shops.subscription_tier CHECK)

---

## Checkout & Transaction Decisions

### Checkout Atomicity: Single RPC (not Sequential JS Calls)

**What:** Entire checkout flow (sale creation, inventory deduction, kitchen print job, customer stats update) wrapped in a single `checkout_complete()` Supabase RPC call. All steps succeed together or all roll back together.

**Why:** Sequential JavaScript service calls (`salesService.create()` → `productsService.updateStock()` → ...) leave data inconsistent if a middle step fails. A single database transaction guarantees atomicity.

**Implementation:**
- `supabase.rpc('checkout_complete', { p_shop_id, p_cart, p_payment, p_cashier_id })`
- Inside: `SELECT ... FOR UPDATE` on shops row (race condition lock)
- Check daily order limit, generate invoice, insert sale, deduct inventory, create print jobs, update customer stats
- Any failure → automatic rollback of ALL steps

**Source:** `VISION.md v3.1.0 Section 11`, `docs/architecture/database.md` (checkout_complete function)

### Order Limit Enforcement: Server-Side in checkout_complete RPC

**What:** Daily order limit enforced server-side in `checkout_complete()`, not client-side. Free tier: 50/day. Growth/Pro: unlimited (NULL).

**Why:** Client-side enforcement is trivially bypassable. Server-side enforcement inside the atomic checkout transaction is authoritative.

**Race condition protection:** `SELECT ... FOR UPDATE` on the `shops` row serializes concurrent checkouts. Two simultaneous checkouts cannot both read the limit as "under" and proceed.

**Client error handling:** Server raises `DAILY_LIMIT_REACHED` exception. Client catches and shows upgrade prompt.

**Source:** `VISION.md v3.1.0 Section 16`, `docs/architecture/database.md` (checkout_complete function)

---

## Printer & Receipt Decisions

### Printer-First Kitchen Workflow (not KDS)

**What:** Thermal printer integration is the core kitchen workflow. Kitchen Display System (KDS) is optional add-on for v2 restaurant/food_court only.

**Why (Myanmar reality):**
- Heat from cooking equipment damages tablet screens
- Water and steam from washing areas
- Dust and grease accumulation
- Power instability (no reliable UPS)
- Staff unfamiliarity with touch-screen workflows

Thermal paper slips are more reliable than tablets in Myanmar kitchen environments.

**Source:** `VISION.md v3.1.0 Section 8.3`

### Printer Hardware: Bluetooth + Network (Growth+ Only)

**What:** Receipt and kitchen printers supported via Bluetooth and Network (LAN/WiFi). USB printers deferred to v2 (WebUSB via Android Chrome). Free tier: NO printer support at all.

**Why:** Bluetooth works with tablets (POS terminal device). Network works with shared kitchen printers. USB requires WebUSB API which is unreliable across browsers and requires Android Chrome.

**Supported:**
- Receipt printer: Bluetooth, Network
- Kitchen printer: Bluetooth, Network

**Not supported:**
- USB (v2 only)
- Any printer for Free tier

**Source:** `VISION.md v3.1.0 Section 8.1-8.2`

### Print Execution Model: Client-Side Receipt + Async Kitchen

**What:**
- **Receipt printer:** Client-side immediate. Web Bluetooth API or Helper App sends directly from the tablet. No server round-trip.
- **Kitchen printer:** Async via pg_cron. `checkout_complete` inserts `print_jobs` row. pg_cron polls every 30 seconds. Edge Function sends to printer.

**Why:** Receipt printing needs to be instant (customer waiting). Kitchen printing can tolerate 30-second delay (order queue). Async kitchen printing avoids blocking the checkout flow.

**Print failure policy:** Non-critical path. Print failures NEVER roll back a sale. Receipt failure → manual receipt. Kitchen failure → retry queue + alert staff.

**Source:** `VISION.md v3.1.0 Section 8.4-8.5`, `docs/architecture/database.md` (print_jobs table)

### Receipt Management: Toggle + Reprint + Shop Settings (Growth+)

**What:** Growth+ shops get:
- Post-checkout "Print Receipt?" toggle
- Shop setting: Always / Ask each time / Never
- Reprint from Transaction History

Free tier: No receipt printing, no toggle, no reprint. Transaction History visible but "Reprint" hidden.

**Why:** Receipt management is a Growth+ feature because it requires printer hardware (also Growth+). Free tier shops use hand-written receipts or no receipts.

**Source:** `VISION.md v3.1.0 Section 9`, `docs/architecture/database.md` (shops.receipt_setting, print_jobs.is_reprint)

---

## Inventory Decisions

### Simplified Inventory Model (Growth+) — No Recipe BOM

**What:** Growth+ shops use Purchase Log + Stock Overview + Low Stock Alerts. No per-recipe ingredient tracking, no auto-deduction, no COGS calculation. Profit = Revenue − Purchases (monthly).

**Why (VISION.md v3.1.0 §10.3):** Myanmar coffee shops buy supplies in bulk (beans, milk, cups, sugar) weekly or monthly. They sell finished drinks daily. They do NOT track exact ingredient usage per recipe. Monthly profit (Revenue − Purchases) is sufficient.

**What we do NOT build:**
- Recipe BOM / Bill of Materials — too complex for Myanmar coffee shop reality
- Auto-deduct ingredients on sale — requires precise recipes; shops don't track this
- Per-drink COGS calculation — monthly profit is sufficient
- Consumption log per ingredient — no auto-deduction means no consumption to log
- UOM conversion system — not needed without recipe tracking
- Waste tracking per recipe — no recipe tracking; use low stock alerts instead

**Purchase Log (Growth+):** Owner records purchases — date, supplier, item, quantity, unit cost, total cost.

**Stock Overview (Growth+):** Current supply levels (manual entry), manual adjustment (weekly after physical count), low stock alerts (threshold-based).

**Simple Profit Report (Pro):** Monthly Revenue = sum of sales. Monthly Purchases = sum of purchase logs. Profit = Revenue − Purchases.

**Deprecated DB tables:** `recipes`, `recipe_lines`, `consumption_log`, `raw_materials`, `uom_conversions` — exist in DB but unused by v1 code. See `docs/specs/inventory-model.md`.

**Source:** `VISION.md v3.1.0 Section 10`, `docs/specs/inventory-model.md`, `docs/specs/tier-spec.md §2.2 Dead Keys`

---

## Cash Drawer & Shift Decisions

### Cash Drawer / Shift Management: Growth+ (not Pro)

**What:** Shift start/end, variance tracking, theft alerts. Available from Growth tier.

**Why:** This is a **revenue-driving feature**, not a premium feature. The primary pain point is "I'm afraid my cashier will cheat me" — this is a Growth-tier problem (mid-size shops with multiple staff), not a Pro-tier problem.

**Workflow:**
1. Shift start: cashier enters opening cash (physical count)
2. During shift: all sales recorded against shift
3. Shift end: cashier enters closing cash, system calculates variance
4. Variance thresholds: Green (≤1,000 MMK), Yellow (≤10,000 MMK), Red (>10,000 MMK)

**Source:** `VISION.md v3.1.0 Section 12`, `docs/architecture/database.md` (cash_shifts table)

---

## Platform Admin Decisions

### Platform Admin: Edge Function Only (Zero Direct DB Access)

**What:** All platform admin operations route through Supabase Edge Functions using `service_role` key. Platform admin UI never calls `supabase.from()` directly.

**Why:**
- `service_role` key never exposed to client bundle (`VITE_` prefix would inline it)
- Edge Functions run server-side — key stays in Supabase environment
- RLS policies remain clean — no `OR role = 'platform_admin'` exceptions
- Single gateway for all admin operations — auditable, rate-limitable

**Edge Function inventory:**
| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activate shop + membership + user |
| `platform-admin-reject-shop` | Deny pending shop application |
| `platform-admin-update-subscription` | Change shop subscription_tier |
| `platform-admin-list-shops` | List all shops with status |
| `platform-admin-get-shop-detail` | Full shop + owner + membership info |
| `platform-admin-manage-features` | Update feature_definitions rows |
| `platform-admin-daily-stats` | Platform-wide metrics (MRR, active shops) |

**Source:** `VISION.md v3.1.0 Section 17`, `docs/architecture/database.md` (feature_definitions table)

---

## Multi-Tenancy Approach

### Per-Shop Roles via shop_memberships

**What:** `shop_memberships` table with `user_id`, `shop_id`, `role`, `is_active`. A user can be admin at Shop A and cashier at Shop B.

**Why:** Global `users.role` doesn't support multi-shop scenarios. Per-shop membership allows role flexibility.

**4 roles (VISION.md v3.1.0 Section 4):**
- `platform_admin` — cross-tenant, no shop_memberships row, Edge Function only
- `admin` — shop owner, full access
- `manager` — shift supervisor, POS + operations + reports
- `cashier` — POS terminal only

**`users.role` status:** Retained for backward compatibility. Canonical source is `shop_memberships.role`.

**Source:** `docs/specs/multi-tenancy.md`, `VISION.md v3.1.0 Section 4`

### RLS Scoped via current_shop_ids()

**What:** All RLS policies use `shop_id = ANY(current_shop_ids())`. The helper function returns shop IDs from the user's active memberships.

**Why:** Single function to query — avoids duplicating the membership subquery in every policy. Change the scoping logic in one place.

**Source:** `docs/architecture/auth.md`, `docs/architecture/database.md` (current_shop_ids function)

### Phased Migration

**What:** Chunk 1 (schema) → Chunk 2 (RLS rewrite) → Chunk 3 (service layer). Each chunk is independently deployable.

**Why:** Reduces risk. Schema changes are zero-behavior-change. RLS rewrite is medium-risk. Service layer is frontend-only.

**Source:** `docs/architecture/adr/003-shop-id-placeholder-now.md`

---

## Currency & Myanmar Market

### MMK-Only Currency (No Multi-Currency)

**What:** App operates exclusively in Myanmar Kyat (MMK). No multi-currency support, no exchange rates, no currency conversion. `CurrencyContext` and `currencyUtils.ts` are hardcoded to MMK.

**Why (VISION.md v3.1.0 §19):** Myanmar coffee shops don't need currency conversion. Multi-currency adds complexity with zero value for the target market.

**Deprecated DB tables:** `currency_config`, `exchange_rates`, `exchange_rate_history` — exist in DB but unused by v1 code.

**Deprecated code:** `CurrencyContext.tsx`, `currencyUtils.ts` — dead code pending removal.

**Source:** `VISION.md v3.1.0 Section 19`, `docs/specs/tier-spec.md §2.2 Dead Keys` (`multi_currency`)

### Myanmar Payment Methods

**What:** Payment methods include `kbzpay`, `wavepay`, `ayapay`, `cbpay`, `mpu` in addition to standard `cash`, `card`, `digital`, `credit`.

**Why:** Myanmar market uses mobile payment apps extensively. These are primary payment methods, not add-ons.

**Accepted for subscription billing:** KBZpay, AYApay, UABpay, MMQR.

**Source:** `src/types/index.ts`, `src/components/pos/CheckoutModal.tsx`, `VISION.md v3.0.0 Section 3.4`

---

## Device Architecture Decisions

### Layer-Based Device Strategy

**What:**
| Layer | Device | Form Factor | Purpose |
|-------|--------|-------------|---------|
| POS Terminal | Counter tablet | Mobile/tablet-first, PWA | Order taking, checkout, receipts |
| Owner Mobile | Owner's phone | Mobile-first | Reports/insights only, no POS |
| Platform Admin | Desktop browser | Desktop-first | Shop management, subscriptions |

**Why:** Different users have different needs. Cashiers need fast touch UI on a tablet. Owners need to check reports on their phone. Platform admin needs desktop for bulk operations.

**Owner Mobile:** Pro tier feature. Read-only dashboard (daily P&L, shift variances, alerts). No POS terminal, no product/inventory management.

**Source:** `VISION.md v3.1.0 Section 7`

---

## Auth Decisions

### Supabase Auth with DB Trigger for Profile + Shop + Membership Creation

**What:** `handle_new_auth_user()` trigger on `auth.users` INSERT creates:
1. `public.users` row (active=false)
2. `shops` row (is_active=false, business_type='coffee_shop', subscription_tier='free', daily_order_limit=50)
3. `shop_memberships` row (role='admin', is_active=false)

All three remain inactive until `platform_admin` approves via Edge Function.

**Why:** Ensures every auth user has a profile, shop, and membership. Trigger runs server-side with elevated privileges. Manual approval prevents spam and ensures quality onboarding.

**Source:** `docs/architecture/auth.md`, `VISION.md v3.1.0 Section 6`

### Admin Creates Users via signUp + Session Save/Restore

**What:** Admin's `signUp()` call replaces current session. Code saves admin session before signUp, restores it after, then UPDATEs the new user's profile with admin-chosen role.

**Why:** Supabase Auth has no admin "create user" API that doesn't change session. This is the documented workaround.

**Source:** `docs/architecture/auth.md`

### Four Roles: platform_admin, admin, manager, cashier

**What:**
- `platform_admin` — cross-tenant, manages all shops, approves signups, activates subscriptions
- `admin` — shop owner, full access to their shop
- `manager` — shift supervisor, POS + operations + reports (no user management)
- `cashier` — POS terminal only

**Why:** Coffee shop has platform operator (Ko Htun), owner (admin), shift supervisors (manager), and baristas (cashier). Roles enforced in UI (App.tsx renderCurrentView, Header nav items), database (RLS policies), and Edge Functions (platform_admin JWT validation).

**Source:** `docs/architecture/auth.md`, `VISION.md v3.1.0 Section 4`

### No Instant Access (Manual Approval Required)

**What:** All signups require manual approval by `platform_admin`. No self-service activation, no automated approval, no "try before review" flow.

**Why:** Quality control. Ko Htun reviews every shop before activation. Prevents spam, ensures correct setup, enables personal onboarding relationship.

**Source:** `VISION.md v3.1.0 Section 6.4`

---

## Security Decisions

### service_role Key Removed from Client Bundle

**What:** The `supabaseAdmin` client using `VITE_SUPABASE_SERVICE_ROLE_KEY` was removed. Admin operations require Edge Functions.

**Why:** `VITE_` prefixed env vars are inlined into the JS bundle at build time, exposing the key to any visitor via DevTools. Edge Functions run server-side and are not exposed.

**Source:** `src/lib/supabase.ts`

### SECURITY DEFINER Functions Locked Down

**What:** `rls_auto_enable()` and other SECURITY DEFINER functions have EXECUTE revoked from `anon` and `authenticated` roles. Only `service_role` and `postgres` can call them.

**Why:** SECURITY DEFINER functions bypass RLS. If callable by authenticated users, they become privilege escalation vectors.

**Source:** `docs/specs/roadmap.md`

### Function search_path Hardened

**What:** All public functions have `SET search_path = ''`.

**Why:** Prevents search-path injection attacks where a malicious schema is created to shadow expected functions.

**Source:** `docs/specs/roadmap.md`

---

## PWA & Offline Decisions

### PWA: Installable with Soft-Offline (v1)

**What:** Installable iPad app with cached UI shell. Cart survives refresh. Supabase API calls use NetworkFirst (5-second timeout). Google Fonts cached for 1 year.

**Why:** Coffee shop has intermittent connectivity. Cart persistence prevents lost sales during brief outages.

**Source:** `docs/specs/roadmap.md`

### Offline Strategy: Graceful Degradation (All Tiers, No Tier Gating)

**What:** When connection is lost: warning banner, cart preserved in localStorage, checkout disabled. When restored: banner dismissed, checkout re-enabled.

**Why:** Offline checkout requires complex conflict resolution and invoice reconciliation. v1 focuses on graceful degradation — the cart is preserved, but checkout requires connectivity. All tiers get the same behavior (no tier gating).

**v2 planned:** Offline queue for cash-only transactions (IndexedDB, auto-sync on reconnection).

**Source:** `VISION.md v3.1.0 Section 15`

---

## Owner Insights Decisions (Pro Tier)

### Daily P&L Dashboard: 3 Numbers Only

**What:** Revenue, Purchases, Gross Profit. No complex charts, no drill-downs, no trend lines in v1.

**Why:** Owners need to answer "How much profit today?" — not analyze quarterly trends. Purchases are manually logged via Purchase Log (Growth+).

**Source:** `VISION.md v3.1.0 Section 13.2`

### WhatsApp/Viber Daily Report Push

**What:** Daily at 9:00 PM (Asia/Yangon). Sent via WhatsApp Business API. Includes revenue, purchases, profit, shift count, variance alerts.

**Why:** Owners want to check their shop's performance from home. WhatsApp is the most-used messaging app in Myanmar.

**Source:** `VISION.md v3.1.0 Section 13.3`

---

## Not Yet Decided (Pending)

| Topic | Status | Source |
|-------|--------|--------|
| i18n library (react-i18next vs react-intl vs custom) | Scoping needed | `docs/specs/roadmap.md` |
| Offline checkout queue (v2) | Needs real connectivity data | `VISION.md v3.1.0 Section 15.2` |
| Sales tab sharing between baristas | Not on roadmap | `docs/specs/roadmap.md` |
| Digital receipts (WhatsApp/Email) | v2 only | `VISION.md v3.1.0 Section 9.4` |
| Waiter tablets | v2 only | `VISION.md v3.1.0 Section 14.2` |
| Multi-branch dashboard | v2 only | `VISION.md v3.1.0 Section 19` |
