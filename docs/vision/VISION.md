# VISION.md — CoffeeShop POS Platform

| Field | Value |
|-------|-------|
| **Version** | 3.1.0 |
| **Date** | 2026-07-13 |
| **Status** | LOCKED |
| **Author** | Ko Htun |
| **Scope** | Business vision for Myanmar coffee/tea shop POS platform |

> This document defines WHAT we are building and WHY.
> Technical implementation details belong in architecture docs and feature specs.
> To amend this document, a new version must be authored with explicit rationale.
> For document conflict resolution, see `docs/GOVERNANCE.md`.

---

## 1. Platform Identity

**Name:** CoffeeShop POS
**Market:** Myanmar coffee shops and tea shops
**Target:** ~20 shops
**Model:** Multi-tenant SaaS, subscription-based (3-tier)
**Deployment:** Supabase (BaaS) + Vite SPA, PWA installable
**Timezone:** Asia/Yangon (locked at database level)

**Target customers:**
- Coffee shops
- Tea shops (identical workflow to coffee shops)

**What we are NOT:** A general-purpose POS. We do not serve retail, pharmacy, restaurant, food court, or non-F&B verticals in v1.

---

## 2. Business Types

### 2.1 v1: Single Type

| Type | Status | DB Value | Notes |
|------|--------|----------|-------|
| Coffee Shop | v1 (live) | `coffee_shop` | Covers both coffee and tea shop workflows |

### 2.2 v2: Future Types (Planned)

| Type | Status | DB Value | Notes |
|------|--------|----------|-------|
| Restaurant | v2 | `restaurant` | Table service, kitchen routing |
| Food Court | v2 | `food_court` | Multi-vendor stall model |

### 2.3 Permanently Excluded

The following business types will never be supported:
- ~~pharmacy~~
- ~~retail~~
- ~~supermarket~~
- ~~other~~

**Default value:** `coffee_shop`

---

## 3. Subscription Tiers

### 3.1 Tier Definitions

| Tier | Price | Target Customer |
|------|-------|-----------------|
| **Free** | 0 MMK/month | Small shops, trial users |
| **Growth** | 49,000 MMK/month | Mid-size shops, multi-staff |
| **Pro** | 149,000 MMK/month | High-volume shops, owner needs insights |

### 3.2 Feature Matrix

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| POS Terminal | ✅ | ✅ | ✅ |
| Product Management | ✅ (max 50) | ✅ (unlimited) | ✅ (unlimited) |
| Customer Management | ✅ | ✅ | ✅ |
| Basic Discounts | ✅ | ✅ | ✅ |
| Currency | MMK only | MMK only | MMK only |
| Daily Order Limit | 50/day | Unlimited | Unlimited |
| Receipt Printing | ❌ | ✅ | ✅ |
| "Print?" Toggle | ❌ | ✅ (forced) | ✅ (configurable) |
| Shop Receipt Setting | ❌ | ✅ | ✅ |
| Reprint from History | ❌ | ✅ | ✅ |
| Purchase Log | ❌ | ✅ | ✅ |
| Stock Overview | ❌ | ✅ | ✅ |
| Low Stock Alerts | ❌ | ✅ | ✅ |
| Cash Drawer / Shift Mgmt | ❌ | ✅ | ✅ |
| Simple Profit Report | ❌ | ❌ | ✅ |
| Owner Insights (P&L) | ❌ | ❌ | ✅ |
| WhatsApp Daily Report | ❌ | ❌ | ✅ |

### 3.3 Free Tier Limits

**50 orders/day** — enforced server-side in checkout flow (not client-side). Race condition protection ensures concurrent checkouts cannot bypass the limit.

**Max 50 products** — enforced at product creation with client-side validation and server-side guard.

**No printer support** — Free tier cannot connect any printer hardware. Manual receipt only (hand-written or no receipt).

**No purchase log or stock tracking** — No purchase logging, no stock overview, no low stock alerts. Upgrade to Growth for inventory features.

**No reprint capability** — Transaction history exists but "Reprint" button hidden.

### 3.4 Billing Model

**Model:** Manual High-Touch

```
Customer contacts Ko Htun (phone/Viber/WhatsApp)
  → Ko Htun confirms tier and duration
  → Customer transfers payment via KBZpay / AYApay / UABpay / MMQR
  → Ko Htun verifies payment receipt
  → Ko Htun activates subscription in Platform Admin UI
  → Customer notified
```

**Accepted payment methods:**
- KBZpay
- AYApay
- UABpay
- MMQR

**NOT accepted:**
- ~~Stripe~~
- ~~Credit/Debit cards~~
- ~~International payment gateways~~

### 3.5 Grace Period

- **Duration:** 5 days after subscription expiry
- **Behavior:** Shop remains fully functional during grace period
- **After grace:** Automatic downgrade to Free tier features
- **Data:** No data deleted — features become inaccessible, data preserved
- **Reactivation:** Full access restored upon payment and manual tier update

---

## 4. Role Model

### 4.1 Role Definitions

| Role | Scope | Purpose |
|------|-------|---------|
| `platform_admin` | Cross-tenant | Platform operator (Ko Htun). Manages all shops, approves signups, activates subscriptions. |
| `admin` | Per-shop | Shop owner. Full access to their shop's features, settings, and staff. |
| `manager` | Per-shop | Shift supervisor. POS, inventory, reports, customer management. No user management or shop settings. |
| `cashier` | Per-shop | Barista/staff. POS terminal only. |

### 4.2 Authorization Source of Truth

**Shop-level authorization:** `shop_memberships.role` is the canonical source. A user's role at a specific shop is defined by their membership row.

**`users.role` status:** Retained temporarily for backward compatibility only. Long-term target is to deprecate `users.role` in favor of `shop_memberships.role`.

### 4.3 platform_admin Specifics

- **No shop_memberships row:** `platform_admin` does not have entries in `shop_memberships`. They operate cross-tenant.
- **No RLS bypass in policies:** RLS policies do NOT contain `OR users.role = 'platform_admin'`. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions.
- **All operations via Edge Functions:** Every platform admin action routes through Supabase Edge Functions using the `service_role` key. Zero direct database access from the platform admin UI.

### 4.4 Role Matrix

| Operation | platform_admin | admin | manager | cashier |
|-----------|:-:|:-:|:-:|:-:|
| POS Terminal | ❌ | ✅ | ✅ | ✅ |
| Manage Products | ❌ | ✅ | ✅ | ❌ |
| Manage Inventory | ❌ | ✅ | ✅ | ❌ |
| Manage Customers | ❌ | ✅ | ✅ | ❌ |
| Manage Discounts | ❌ | ✅ | ✅ | ❌ |
| View Reports | ❌ | ✅ | ✅ | ❌ |
| Owner Insights | ❌ | ✅ | ❌ | ❌ |
| Shop Settings | ❌ | ✅ | ❌ | ❌ |
| Manage Staff | ❌ | ✅ | ❌ | ❌ |
| Approve Signups | ✅ | ❌ | ❌ | ❌ |
| Manage Subscriptions | ✅ | ❌ | ❌ | ❌ |
| View All Tenants | ✅ | ❌ | ❌ | ❌ |
| Manage Feature Defs | ✅ | ❌ | ❌ | ❌ |

---

## 5. Feature Flag Architecture

### 5.1 Design Principle

**Capability-based, not conditional.** The server resolves all feature logic. The client receives a flat list of capabilities. No tier/type conditionals exist in component code.

### 5.2 Resolution Flow

At login time, the server reads the shop's subscription tier, business type, and per-shop overrides. It resolves these into a flat list of capability strings (e.g., `['pos', 'inventory', 'printer_integration']`) and returns them to the client.

Components check capabilities like: `if (capabilities.includes('printer_integration')) { ... }`

### 5.3 Two Gates (Server-Side Only)

**Gate 1: Subscription Tier** — Features below the shop's tier level are disabled. Free shops cannot access Growth+ features regardless of per-shop overrides.

**Gate 2: Business Type Defaults** — Different business types get different default capability sets. Coffee shops get POS + inventory + discounts. Restaurants (v2) additionally get table management.

### 5.4 Client-Side Contract

The client stores a `capabilities: string[]` array. Components check this array to show/hide features.

**Prohibited patterns in components:**
- Checking `shop.subscriptionTier` directly
- Checking `shop.businessType` directly
- Reading `feature_definitions` table client-side

### 5.5 Capability Keys

| Capability | Description | Min Tier | Business Types |
|------------|-------------|----------|----------------|
| `pos` | POS terminal | free | all |
| `inventory` | Stock tracking | free | all |
| `discounts` | Discount engine | free | all |
| `draft_sales` | Draft/pending sales | free | all |
| `customer_management` | Customer records | free | all |
| `batch_tracking` | Batch/lot tracking (embedded in ProductModal) | free | all |
| `weight_based_products` | Per-unit/weight-based pricing (embedded in ProductModal) | free | all |
| `credit_system` | Customer credit tracking | free | all |
| `multi_tab_sales` | Multi-tab POS workflow | free | all |
| `printer_integration` | Thermal printer | growth | all |
| `purchase_log` | Purchase recording | growth | all |
| `stock_overview` | Stock levels & adjustments | growth | all |
| `low_stock_alerts` | Threshold-based alerts | growth | all |
| `staff_accounts` | Multiple staff logins | growth | all |
| `cash_drawer` | Shift start/end | growth | all |
| `owner_insights` | P&L dashboard | pro | all |
| `simple_profit_report` | Revenue − Purchases | pro | all |
| `advanced_reports` | Consolidated Pro reports gate (parent of `owner_insights`, `simple_profit_report`) | pro | all |

---

## 6. Authentication Policy

### 6.1 Primary Method

**Email + Password** — canonical authentication method.

**Rationale:** Shop ownership must not be tied to a personal Google account. Email-based auth ensures:
- Shop account is independent of personal accounts
- Ownership transfer is possible (change email)
- No dependency on third-party OAuth availability

### 6.2 Optional Method

**Google OAuth** — convenience login only, not primary.

- Available as a "Sign in with Google" option
- Still creates an email-based account (uses Google email)
- Owner can later add a password and sign in without Google

### 6.3 Onboarding Flow

1. **Signup:** User submits email, password, shop name. Supabase Auth creates auth user, trigger creates inactive public user, shop, and membership.

2. **Email Verification:** Supabase sends confirmation email. User clicks verification link.

3. **Pending Approval:** User signs in after email verification. App shows "Your shop is pending approval."

4. **Platform Admin Review:** Ko Htun sees new pending shop in Platform Admin UI. Reviews shop name, business type, owner email. Decides: Approve or Reject.

5a. **Approval:** Edge Function activates user, membership, and shop. Sets subscription to Free tier. Email notification sent.

5b. **Rejection:** Edge Function sends rejection email with reason. Shop remains inactive.

### 6.4 Rule

**No instant access.** All signups require manual approval by `platform_admin`. There is no self-service activation, no automated approval, no "try before review" flow.

---

## 7. Device Architecture

### 7.1 Layer-Based Strategy

| Layer | Device | Form Factor | Purpose |
|-------|--------|-------------|---------|
| **POS Terminal** | Counter tablet | Mobile/tablet-first, PWA | Order taking, checkout, receipts |
| **Owner Mobile** | Owner's phone | Mobile-first | Reports/insights only, NO POS terminal |
| **Platform Admin** | Desktop browser | Desktop-first | Shop management, subscriptions |

### 7.2 POS Tablet

- Mobile/tablet-first responsive design
- PWA installable (Add to Home Screen)
- Touch-optimized UI
- All POS features: cart, checkout, discounts, customer lookup
- Receipt printing via Bluetooth/Network (Growth+)

### 7.3 Owner Mobile (Pro Tier)

- Mobile-first responsive design
- Read-only dashboard: daily P&L, shift variances, alerts
- NO POS terminal functionality
- NO product/inventory management
- Purpose: "Check my shop from anywhere"
- **Available in v1** (Pro tier feature)

### 7.4 Platform Admin

- Desktop-first UI
- Full admin capabilities (see Section 16)
- Component tree under `src/components/platform/`

---

## 8. Printer Integration

### 8.1 Supported Hardware (Growth+ Only)

| Printer Type | Connection | Status |
|-------------|------------|--------|
| Receipt Printer | Bluetooth | ✅ Growth+ |
| Receipt Printer | Network (LAN/WiFi) | ✅ Growth+ |
| Kitchen Printer | Bluetooth | ✅ Growth+ |
| Kitchen Printer | Network (LAN/WiFi) | ✅ Growth+ |
| Any Printer | USB | ❌ v2 only (WebUSB via Android Chrome) |

### 8.2 Free Tier: NO Printer Support

Free tier cannot connect any printer hardware. Options:
- Hand-written receipts
- No receipt
- Upgrade to Growth for printer support

### 8.3 Myanmar Reality: Why Printer-First

Tablets in kitchen environments are impractical in Myanmar:
- Heat from cooking equipment damages screens
- Water and steam from washing areas
- Dust and grease accumulation
- Power instability (no reliable UPS)
- Staff unfamiliarity with touch-screen workflows

**Result:** Thermal printer integration is the core kitchen workflow, not Kitchen Display System (KDS).

### 8.4 Print Execution Model

**Receipt Printer — Client-side immediate:**
- Checkout triggers client-side formatting
- Web Bluetooth API or Helper App sends to printer
- Immediate print, no server round-trip
- Failure = non-critical (sale not rolled back)

**Kitchen Printer — Async via pg_cron:**
- Checkout inserts print job record
- pg_cron polls for pending jobs every 30 seconds
- Edge Function sends to kitchen printer
- Failure = retry queue, no sale rollback

### 8.5 Print Failure Policy

**Non-critical path.** Print failures never roll back a sale:
- Receipt print failure → sale completes, manual receipt available
- Kitchen print failure → sale completes, retry queue, alert staff
- Both → sale always committed, staff can manually handle

---

## 9. Receipt Management (Growth+)

### 9.1 Checkout Flow

**Post-checkout behavior:**
1. Sale completes (always committed regardless of print status)
2. If Growth+ and printer connected: "Print Receipt?" prompt appears
3. If Free tier: no prompt, no print option
4. If Growth+ but no printer configured: no prompt

### 9.2 Shop Setting (Growth+)

| Setting | Behavior |
|---------|----------|
| **Always** | Auto-print receipt after every checkout |
| **Ask each time** | Show "Print Receipt?" toggle post-checkout (default) |
| **Never** | Never prompt for receipt printing |

Configured in Shop Settings → Receipt Settings (Growth+ only).

### 9.3 Reprint (Growth+)

**Flow:** Transaction History → Select sale → "Reprint Receipt" button → formats and prints receipt.

Free tier: Transaction History visible but "Reprint" button hidden.

### 9.4 Tier Gating Summary

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| Receipt printing | ❌ | ✅ | ✅ |
| "Print?" toggle | ❌ | ✅ (forced on) | ✅ (configurable) |
| Shop setting (Always/Ask/Never) | ❌ | ✅ | ✅ |
| Reprint from history | ❌ | ✅ | ✅ |
| Digital receipt (WhatsApp/Email) | ❌ | ❌ | v2 |

---

## 10. Simplified Inventory Model (Growth+)

### 10.1 Business Reality

Myanmar coffee shops buy supplies in bulk (beans, milk, cups, sugar) weekly or monthly.
They sell finished drinks daily.
They do NOT track exact ingredient usage per recipe.
Profit is calculated monthly: **Total Sales − Total Purchases**.

### 10.2 How It Works

#### Purchase Log (Growth+)

Owner records purchases:
- Date, supplier name, item description
- Quantity, unit, unit cost, total cost

Example:
```
2026-07-01 | Supplier: ABC Beans | Coffee beans | 5 kg | 8,000 MMK/kg | 40,000 MMK
2026-07-01 | Supplier: City Milk  | Fresh milk   | 20 L | 2,500 MMK/L  | 50,000 MMK
```

#### Stock Overview (Growth+)

- Current supply levels (manual entry, not auto-calculated)
- Manual adjustment (owner updates weekly after physical count)
- Low stock alerts (threshold-based: "coffee beans below 2 kg → alert")

#### Simple Profit Report (Pro)

- Monthly Revenue = sum of all sales
- Monthly Purchases = sum of all purchase logs
- **Profit = Revenue − Purchases**
- No per-recipe COGS, no ingredient deduction, no consumption log

### 10.3 What We Do NOT Build

| Removed Feature | Reason |
|----------------|--------|
| Recipe BOM / Bill of Materials | Too complex for Myanmar coffee shop reality |
| Auto-deduct ingredients on sale | Requires precise recipes; shops don't track this |
| Per-drink COGS calculation | Monthly profit (Revenue − Purchases) is sufficient |
| Consumption log per ingredient | No auto-deduction means no consumption to log |
| UOM conversion system | Not needed without recipe tracking |
| Waste tracking per recipe | No recipe tracking; use low stock alerts instead |

### 10.4 Tier Gating

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| Product management | ✅ (50 max) | ✅ (unlimited) | ✅ (unlimited) |
| Purchase log | ❌ | ✅ | ✅ |
| Stock overview | ❌ | ✅ | ✅ |
| Low stock alerts | ❌ | ✅ | ✅ |
| Simple profit report | ❌ | ❌ | ✅ |

---

## 11. Checkout Atomicity

### 11.1 Problem

Sequential JavaScript service calls cause data inconsistency. If step 2 fails after step 1 commits, the database is left in an inconsistent state.

### 11.2 Solution

**Single atomic RPC.** The entire checkout flow (sale creation, inventory deduction, customer stats) MUST be a single Supabase RPC call wrapped in a database transaction.

All steps succeed together, or all steps roll back together.

### 11.3 Rule

**No sequential JavaScript service calls for checkout.** Use `supabase.rpc('checkout_complete', ...)` only.

---

## 12. Cash Drawer / Shift Management (Growth+)

### 12.1 Why Growth+ (Not Pro)

Cash drawer/shift management is a **revenue-driving feature**. The primary pain point:

> "I'm afraid my cashier will cheat me"

This is a Growth-tier problem, not a Pro-tier problem. Mid-size shops with multiple staff need this now.

### 12.2 Flow

```
Shift Start:
  Cashier opens shift
  → Enters opening cash amount (physical count)
  → System records shift start

During Shift:
  → All cash sales recorded against this shift
  → All card/digital sales recorded against this shift
  → Running totals maintained

Shift End:
  Cashier closes shift
  → Enters actual cash count (physical count)
  → System calculates:
    - Expected Cash = Opening Cash + Cash Sales - Cash Refunds
    - Actual Cash = Cashier's physical count
    - Variance = Actual - Expected
  → Variance highlighted:
    - Green: |variance| ≤ 1,000 MMK (acceptable)
    - Yellow: 1,000 < |variance| ≤ 10,000 MMK (review needed)
    - Red: |variance| > 10,000 MMK (theft/error alert)
  → Owner receives variance report
```

---

## 13. Owner Insights (Pro)

### 13.1 Philosophy

Owners need answers to two questions:
1. **"How much profit today?"**
2. **"Is my cashier stealing?"**

Everything else is secondary. Owner Insights is built around these two questions.

### 13.2 Daily P&L Dashboard

**Display:** Three numbers only — Revenue, Purchases, Gross Profit.

- **Revenue:** Sum of sales for the day
- **Purchases:** Sum of purchase logs (manual entry by owner)
- **Gross Profit:** Revenue − Purchases

No complex charts, no drill-downs, no trend lines in v1.

### 13.3 WhatsApp/Viber Daily Report

**Schedule:** Daily at 9:00 PM (Asia/Yangon)

**Delivery:** WhatsApp Business API

**Message includes:** Revenue, Purchases, Profit, Shift count, Variance alerts

### 13.4 Cash Drawer Variance Alerts

Pro tier owners receive real-time alerts when shift variances exceed thresholds (Red: >10,000 MMK).

---

## 14. Waiter Tablet

### 14.1 v1: Counter-Only Workflow

Waiter tablets are NOT part of v1. The v1 workflow:

```
Customer orders at counter
  → Cashier enters order on POS tablet
  → Receipt prints for kitchen (Growth+)
  → Kitchen prepares order
  → Cashier calls customer or delivers to counter
```

### 14.2 v2: Waiter Tablets (Planned)

- Waiter carries tablet to tables
- Flexible routing: counter control OR direct to kitchen
- Table management integration
- Restaurant/food court business types

---

## 15. Offline Strategy

### 15.1 v1: Graceful Degradation (All Tiers)

**No tier gating.** All tiers get the same offline behavior.

```
Connection lost detected
  → Warning banner displayed at top of screen
  → Cart preserved in localStorage (survives refresh)
  → Checkout button disabled
  → Message: "No internet connection. Please reconnect to complete checkout."

Connection restored
  → Banner dismissed
  → Checkout re-enabled
  → Data syncs normally
```

### 15.2 v2: Offline Queue (Planned)

- Cash-only transactions accepted offline
- Stored in IndexedDB with offline UUID
- Sync queue with retry-with-backoff on reconnection
- Invoice reconciliation on sync (conflict detection)

### 15.3 Myanmar Recommendation

Include in onboarding guide: Keep a dedicated SIM with a data plan for the shop's tablet. If WiFi goes down, use a mobile hotspot from a phone. Most Myanmar carriers (MPT, Telenor, Ooredoo, Mytel) offer affordable data plans.

---

## 16. Order Limit Enforcement

### 16.1 Principle

**Server-side enforcement in checkout flow** (not client-side). The daily order limit is checked during the atomic checkout transaction.

### 16.2 Race Condition Protection

Concurrent checkouts are serialized at the shop row level using database row locking. Two simultaneous checkouts cannot bypass the daily limit.

### 16.3 Tier Limits

| Tier | Daily Order Limit | Product Limit |
|------|-------------------|---------------|
| Free | 50/day | 50 products |
| Growth | Unlimited | Unlimited |
| Pro | Unlimited | Unlimited |

### 16.4 Client-Side Error Handling

When the server returns a `DAILY_LIMIT_REACHED` error, the client shows an upgrade prompt: "You've reached the 50 order/day limit on the Free plan. Upgrade to Growth for unlimited orders."

---

## 17. Platform Admin

### 17.1 Architecture

**Desktop-first UI.** Edge Function only. Zero direct DB access.

```
Platform Admin UI (React)
  → supabase.functions.invoke('platform-admin-...')
    → Edge Function (service_role key)
      → Direct Postgres access (bypasses RLS)
        → Response returned to client
```

### 17.2 Why This Pattern

- `service_role` key never exposed to client bundle
- Edge Functions run server-side — key stays in Supabase environment
- RLS policies remain clean — no `OR role = 'platform_admin'` exceptions
- Single gateway for all admin operations — auditable, rate-limitable

### 17.3 Edge Function Inventory

| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activate shop + membership + user |
| `platform-admin-reject-shop` | Deny pending shop application |
| `platform-admin-update-subscription` | Change shop subscription_tier |
| `platform-admin-list-shops` | List all shops with status |
| `platform-admin-get-shop-detail` | Full shop + owner + membership info |
| `platform-admin-manage-features` | Update feature_definitions rows |
| `platform-admin-daily-stats` | Platform-wide metrics (MRR, active shops) |
| `staff-create` | Create staff user in specific shop (bypasses self-registration trigger shop+membership creation) |
| `platform-admin-list-users` | List users across shops — ⚠️ DEPRECATED (VISION.md §4.4) |
| `platform-admin-toggle-user-active` | Activate/deactivate user membership — ⚠️ DEPRECATED (VISION.md §4.4) |
| `platform-admin-update-user-role` | Change user role — ⚠️ DEPRECATED (VISION.md §4.4) |

### 17.4 Client-Side Constraint

Platform admin operations MUST use `supabase.functions.invoke()` only. Never use `supabase.from()` for platform admin operations.

### 17.5 Platform Admin UI

```
src/components/platform/
  ├── PlatformDashboard.tsx      # Overview: pending shops, MRR, active count
  ├── PendingShopsList.tsx       # Approval queue
  ├── ShopDetail.tsx             # Full tenant view
  ├── SubscriptionManager.tsx    # Tier changes, manual activation
  ├── FeatureDefinitions.tsx     # Global feature catalog
  └── PlatformLayout.tsx         # Admin-specific layout/nav
```

---

## 18. Technical Constraints

### 18.1 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3, TypeScript 5.5 (strict), Vite |
| Backend | Supabase (Postgres, Auth, Edge Functions, Realtime) |
| Styling | Tailwind CSS 3.4 (Espresso & Copper theme) |
| Animations | Framer Motion |
| Charts | Recharts |
| Notifications | SweetAlert2 |

### 18.2 Database Rules

- All tables have `shop_id UUID NOT NULL` (tenant isolation)
- All tables have RLS enabled
- Shop-scoped RLS uses `current_shop_ids()` helper function
- `platform_admin` never appears in RLS policies — bypasses via `service_role`
- Dates: `TIMESTAMP WITH TIME ZONE` everywhere
- Timezone: `SET timezone = 'Asia/Yangon'` at database level
- `CURRENT_DATE` uses Asia/Yangon timezone
- JSONB for flexible fields: `items`, `payments`, `conditions`, `config_data`
- `snake_case` in DB, `camelCase` in TypeScript, mapping in service layer

### 18.3 Service Layer Rules

- All DB access through service objects in `src/lib/services.ts`
- No `supabase.from()` calls in components
- Platform admin operations: `supabase.functions.invoke()` only
- Checkout: `supabase.rpc('checkout_complete', ...)` only

---

## 19. What We Are NOT Building (v1)

### Business Scope

| Item | Reason |
|------|--------|
| Restaurant/food court support | Coffee/tea shop only in v1 |
| Native mobile apps (iOS/Android) | PWA is sufficient; native adds 3x cost |
| International payment gateways (Stripe) | Myanmar market uses local mobile payments only |
| Multi-currency / exchange rates | MMK only — Myanmar coffee shops don't need currency conversion |
| Myanmar language UI | v2 — English-first for technical stability |

### ERP / Manufacturing Features (Removed from v1)

| Item | Reason |
|------|--------|
| Recipe BOM / Bill of Materials | Too complex for Myanmar coffee shop workflow; shops buy supplies, not track per-drink ingredients |
| Auto-deduct ingredients on sale | Requires precise recipe data; shops don't track ingredient usage per sale |
| Per-drink COGS calculation | Monthly profit (Revenue − Purchases) is sufficient for shop owners |
| Consumption log per ingredient | No auto-deduction means no consumption to log |
| UOM conversion system | Not needed without recipe-level ingredient tracking |
| Waste tracking per recipe | No recipe tracking; use low stock alerts instead |
| Kitchen Display System (KDS) | Not practical in Myanmar — heat, water, dust damage screens; use thermal printer |

### Hardware / Infrastructure

| Item | Reason |
|------|--------|
| USB printer support | v2 only (WebUSB via Android Chrome) |
| Waiter tablets | v2 only, counter-only workflow in v1 |
| Multi-branch dashboard | v2 only, single-branch in v1 |
| Digital receipts (WhatsApp/Email) | v2 only |
| Printer support for Free tier | Growth+ only |
| Complex offline mode | v1 = graceful degradation only |

### Platform

| Item | Reason |
|------|--------|
| API access for customers | Not in scope |
| Automated billing | Manual high-touch until 50+ paying customers |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 3.1.0 | 2026-07-10 | Scope reframe: removed BOM, COGS, consumption log, UOM conversion, waste tracking, KDS from v1. Simplified inventory model (Purchase Log + Stock Overview + Low Stock Alerts + Simple Profit Report). `multi_currency` moved to DEAD. Cross-document SSOT audit completed — VISION.md confirmed as business scope authority. |
| 3.0.0 | 2026-06-29 | Initial LOCKED version. 3-tier subscription model. 4-role RBAC. Capability-based feature gating. |

---

## Document Dependencies

The following documents MUST be updated to align with this VISION.md:

| Document | Required Changes |
|----------|-----------------|
| `docs/specs/prd.md` | Update tier model (3-tier). Remove Enterprise. Add Free tier limits. Update device architecture. Add role model. |
| `docs/specs/multi-tenancy.md` | Update subscription_tier to (free, growth, pro). Remove Enterprise. Add shop_memberships as auth source. |
| `docs/specs/feature-gating.md` | Align capability keys with 3-tier model. Remove Enterprise tier. Document capability-based architecture. |
| `docs/architecture/decisions.md` | Add printer execution model decision. Add order limit enforcement decision. Add timezone decision. Add checkout atomicity decision. |
| `docs/architecture/database.md` | Add `daily_order_limit` column to shops. Add `print_jobs` table. Add `cash_shifts` table. Update subscription_tier CHECK. |
| `docs/architecture/auth.md` | Add role model (4 roles). Document Edge Function bypass pattern. Update role matrix. Add authentication policy. |
| `docs/architecture/state-management.md` | Add `capabilities: string[]` to AppState. Document checkout RPC pattern. Add receipt management state. Add shift management state. |
| `docs/specs/inventory-model.md` | Simplified inventory: purchase log, stock overview, low stock alerts, simple profit report. |
| `docs/specs/owner-insights.md` | Document P&L dashboard, WhatsApp daily report, variance alerts. |
| `docs/specs/roadmap.md` | Update with 3-tier model, Free tier limits, offline strategy phases, v2 features. |
| `docs/specs/inventory-alerts.md` | Align with Growth+ tier gating. |
| `CLAUDE.md` | Update OUT OF SCOPE list, MMK-only assumption, BOM/COGS/KDS guard. |
