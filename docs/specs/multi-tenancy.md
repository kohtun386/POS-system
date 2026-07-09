# Multi-Tenancy Architecture — CoffeeShop POS

**Status:** Current foundation implemented; dynamic shop configuration pending
**Last updated:** 2026-06-29 (aligned with VISION.md v3.0.0)
**Canonical companion spec:** `docs/specs/dynamic-configuration.md`
**Source of truth:** `docs/vision/VISION.md` v3.0.0

> CURRENT TRUTH: The project is no longer in the pre-migration "zero tenant isolation" state. The `shop_id` foundation exists. This document describes the current foundation and the remaining work needed to complete dynamic per-shop configuration.

---

## 1. Current Foundation

The database has a multi-tenant foundation in place:

- `shops` table exists with a default shop row.
- `shop_memberships` links users to shops with per-shop role metadata.
- Tenant-scoped tables have `shop_id UUID NOT NULL` with a default shop UUID.
- `shop_id` indexes exist for tenant-scoped query paths.
- RLS policies are intended to scope data through active shop memberships.
- There is no shop switching UI yet; users operate in one active shop for now.

The current default shop UUID is:

```txt
4f3dab19-144e-4a29-95a5-2ee82f160ce5
```

## 2. Canonical Configuration Ownership

Dynamic shop configuration moves business identity and POS behavior out of `app_settings` and into `shops`.

| Concern | Canonical Owner | Notes |
|---|---|---|
| Store name, address, phone, email, logo | `shops` | Business identity and receipt branding |
| Tax rate | `shops.tax_rate` | Per-shop POS behavior |
| Display/base currency | `shops.currency`, `shops.base_currency` | Per-shop pricing/display behavior |
| Invoice prefix/counter | `shops.invoice_prefix`, `shops.invoice_counter` | Counter mutated only by atomic DB function |
| Business type | `shops.business_type` | Future feature toggling |
| Draft retention | `shops.draft_retention_days` | Per-shop cleanup policy |
| Interface mode, theme, receipt printer, auto backup | `app_settings` | Global/preferences-style settings |
| Exchange-rate provider/key/update interval | `app_settings` | Global exchange-rate configuration; see security note below |

`app_settings` must no longer be documented or treated as store configuration.

## 3. Target `shops` Shape

The current `shops` foundation is extended by the dynamic configuration spec with these shop-owned fields:

| Column | Purpose |
|---|---|
| `logo` | Store logo, base64 or URL |
| `business_type` | `coffee_shop` (v1). v2 planned: `restaurant`, `food_court`. Permanently excluded: `pharmacy`, `retail`, `supermarket`, `other`. (VISION §2) |
| `tax_rate` | Per-shop tax rate |
| `currency` | Display currency |
| `base_currency` | Base currency for pricing |
| `invoice_prefix` | Invoice number prefix |
| `invoice_counter` | Next invoice counter, DB-owned mutation |
| `draft_retention_days` | Shop-specific draft cleanup retention, default 30 |
| `subscription_tier` | `free`, `growth`, or `pro` (VISION §3.1) |
| `daily_order_limit` | 50 for Free tier, unlimited for Growth/Pro (VISION §16) |

## 4. Target `app_settings` Shape

`app_settings` is trimmed to global/preferences-style fields only:

| Column | Purpose |
|---|---|
| `shop_id` | Existing tenant link for compatibility and cleanup |
| `interface_mode` | `touch` or `traditional` |
| `auto_backup` | Backup preference |
| `receipt_printer` | Receipt printer preference |
| `theme` | `light`, `dark`, or `auto` |
| `exchange_rate_provider` | Rate provider |
| `exchange_rate_api_key` | Provider API key, temporarily stored in DB |
| `exchange_rate_update_interval` | Rate update interval in minutes |

### Exchange-Rate Security Note

Exchange-rate API keys remain in `app_settings` for the current architecture. This is a known security compromise: database-stored API keys are easier to expose than server-side secrets. The future target is to move provider keys into Edge Function secrets or deployment-managed server-side environment variables, with rotation documented in operations docs.

## 5. Invoice Generation Rule

Invoice generation is database-owned.

The source of truth is an atomic database function such as:

```sql
generate_invoice_number(p_shop_id uuid)
```

This function must:

1. Read the target shop's `invoice_prefix` and `invoice_counter`.
2. Generate the invoice number for that shop.
3. Increment the shop's counter in the same database operation.
4. Return the generated invoice number.

Frontend code must not calculate and persist invoice counter increments as the source of truth. UI helpers may format or display invoice data, but the mutation path must be DB-backed to avoid duplicate invoice numbers under concurrent checkout.

## 6. Signup And Approval Flow

Instant-access signup is deprecated.

Canonical flow:

```txt
User signs up
  -> auth user is created
  -> public.users profile is created inactive
  -> shop is created inactive for self-registration
  -> shop_membership is created inactive
  -> user sees Pending Approval after sign-in/verification
  -> authorized approver activates user + membership + shop
  -> user can access the POS
```

Access is granted only when all required gates are active:

| Gate | Required State |
|---|---|
| User profile | `users.active = true` |
| Shop membership | `shop_memberships.is_active = true` |
| Shop | `shops.is_active = true` |

For self-registration, the pending user is intended to become the owner/admin of the newly created shop after approval. Staff created by an existing admin can still be assigned `cashier`, `manager`, or `admin` according to the user-management workflow.

## 7. Role Model

### 7.1 Four Roles (VISION §4.1)

| Role | Scope | Purpose |
|------|-------|---------|
| `platform_admin` | Cross-tenant | Platform operator (Ko Htun). Manages all shops, approves signups, activates subscriptions. |
| `admin` | Per-shop | Shop owner. Full access to their shop's features, settings, and staff. |
| `manager` | Per-shop | Shift supervisor. POS, inventory, reports, customer management. No user management or shop settings. |
| `cashier` | Per-shop | Barista/staff. POS terminal only. |

### 7.2 Authorization Source of Truth

**`shop_memberships.role`** is the canonical source for shop-level authorization. A user's role at a specific shop is defined by their membership row.

**`users.role`** is retained temporarily for backward compatibility only. Long-term target is to deprecate `users.role` in favor of `shop_memberships.role`.

### 7.3 platform_admin Specifics (VISION §4.3)

- **No shop_memberships row:** `platform_admin` does not have entries in `shop_memberships`. They operate cross-tenant.
- **No RLS bypass in policies:** RLS policies do NOT contain `OR users.role = 'platform_admin'`. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions.
- **All operations via Edge Functions:** Every platform admin action routes through Supabase Edge Functions using the `service_role` key. Zero direct database access from the platform admin UI.

### 7.4 Role Matrix

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

### 7.5 Role Gating in RLS

Current implementation uses `users.role` for RLS policy checks. The target is to use `shop_memberships.role` for shop-scoped operations:

```sql
-- Target pattern: shop_memberships.role for shop-scoped operations
AND EXISTS (
  SELECT 1 FROM public.shop_memberships sm
  WHERE sm.user_id = auth.uid()
    AND sm.shop_id = <table>.shop_id
    AND sm.role IN ('admin', 'manager')
    AND sm.is_active = true
)
```

Platform admin operations bypass RLS entirely — they use Edge Functions with `service_role` key, not RLS policies.

## 8. Subscription Tiers (VISION §3)

### 8.1 Tier Definitions

| Tier | Price | Target Customer |
|------|-------|-----------------|
| **Free** | 0 MMK/month | Small shops, trial users |
| **Growth** | 49,000 MMK/month | Mid-size shops, multi-staff |
| **Pro** | 149,000 MMK/month | High-volume shops, owner needs insights |

### 8.2 Feature Gating Summary

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| POS Terminal | ✅ | ✅ | ✅ |
| Product Management | ✅ (max 50) | ✅ (unlimited) | ✅ (unlimited) |
| Daily Order Limit | 50/day | Unlimited | Unlimited |
| Receipt Printing | ❌ | ✅ | ✅ |
| Raw Material Tracking | ❌ | ✅ | ✅ |
| Recipe Management | ❌ | ✅ | ✅ |
| Cash Drawer / Shift Mgmt | ❌ | ✅ | ✅ |
| Profit Margin Analytics | ❌ | ❌ | ✅ |
| Owner Insights (P&L) | ❌ | ❌ | ✅ |

### 8.3 Billing Model

**Manual High-Touch** (VISION §3.4): Customer contacts Ko Htun → confirms tier → payment via KBZpay/AYApay/UABpay/MMQR → Ko Htun activates in Platform Admin UI.

### 8.4 Grace Period

5 days after subscription expiry. Shop remains fully functional during grace. After grace: automatic downgrade to Free tier features. No data deleted. (VISION §3.5)

## 9. Platform Admin Console (VISION §17)

### 9.1 Architecture

Desktop-first UI. Edge Function only. Zero direct DB access.

```
Platform Admin UI (React)
  → supabase.functions.invoke('platform-admin-...')
    → Edge Function (service_role key)
      → Direct Postgres access (bypasses RLS)
        → Response returned to client
```

### 9.2 Edge Function Inventory

| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activate shop + membership + user |
| `platform-admin-reject-shop` | Deny pending shop application |
| `platform-admin-update-subscription` | Change shop subscription_tier |
| `platform-admin-list-shops` | List all shops with status |
| `platform-admin-get-shop-detail` | Full shop + owner + membership info |
| `platform-admin-manage-features` | Update feature_definitions rows |
| `platform-admin-daily-stats` | Platform-wide metrics (MRR, active shops) |

### 9.3 Client-Side Constraint

Platform admin operations MUST use `supabase.functions.invoke()` only. Never use `supabase.from()` for platform admin operations.

### 9.4 Component Tree

```
src/components/platform/
  ├── PlatformDashboard.tsx      # Overview: pending shops, MRR, active count
  ├── PendingShopsList.tsx       # Approval queue
  ├── ShopDetail.tsx             # Full tenant view
  ├── SubscriptionManager.tsx    # Tier changes, manual activation
  ├── FeatureDefinitions.tsx     # Global feature catalog
  └── PlatformLayout.tsx         # Admin-specific layout/nav
```

## 10. Daily Order Limit Enforcement (VISION §16)

**Server-side enforcement** in the atomic checkout flow (not client-side). The daily order limit is checked during the `checkout_complete` RPC.

Concurrent checkouts are serialized at the shop row level using database row locking. Two simultaneous checkouts cannot bypass the daily limit.

| Tier | Daily Order Limit | Product Limit |
|------|-------------------|---------------|
| Free | 50/day | 50 products |
| Growth | Unlimited | Unlimited |
| Pro | Unlimited | Unlimited |

When the server returns a `DAILY_LIMIT_REACHED` error, the client shows an upgrade prompt.

## 11. Remaining Work

Dynamic shop configuration is the next implementation milestone.

Required work:

1. Add missing shop configuration columns.
2. Backfill the default shop from existing `app_settings` store fields.
3. Trim store configuration fields from `app_settings`.
4. Refactor invoice generation to the atomic DB function path.
5. Add `shopsService` and trim `settingsService`.
6. Add `state.shop` and move business/POS reads from `state.settings` to `state.shop`.
7. Update Settings UI to write shop fields through `shopsService` and preference fields through `settingsService`.
8. Replace instant signup documentation and behavior with pending approval.
9. Add or document the approval workflow.
10. Implement platform admin Edge Functions (VISION §17.3).
11. Implement subscription tier management and billing workflow (VISION §3.4).

## 12. Out Of Scope For This Milestone

- Shop switching UI.
- Multi-shop membership selector.
- Receipt layout customization beyond moving receipt data to `shops`.
- Moving exchange-rate API keys to Edge Function secrets; this remains a documented follow-up.

---

## Historical Context: Pre-2026-06-20 State

The original version of this document described the app as single-tenant with no `shop_id` isolation. That was accurate before the shop_id foundation migration and ADR-003. It is retained here only as historical context: the risk it identified was resolved by adding `shops`, `shop_memberships`, default `shop_id` columns, and supporting indexes. Future work should use the current sections above as the source of truth.

---

## Document Dependencies

- **Source of truth:** `docs/vision/VISION.md` v3.0.0
- **Updated companion:** `docs/architecture/database.md` (shops, shop_memberships schema)
- **Updated companion:** `docs/architecture/auth.md` (role model, RLS patterns)
- **Updated companion:** `docs/architecture/state-management.md` (capabilities, checkout RPC)
- **Depends on:** `docs/specs/dynamic-configuration.md` (implementation spec)
- **Depends on:** `docs/specs/feature-gating.md` (capability-based feature gating)