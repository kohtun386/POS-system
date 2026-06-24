# Multi-Tenancy Architecture — CoffeeShop POS

**Status:** Current foundation implemented; dynamic shop configuration pending  
**Last updated:** 2026-06-23  
**Canonical companion spec:** `docs/specs/dynamic-shop-configuration.md`

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
| `business_type` | `coffee_shop`, `pharmacy`, `retail`, `restaurant`, or `other` |
| `tax_rate` | Per-shop tax rate |
| `currency` | Display currency |
| `base_currency` | Base currency for pricing |
| `invoice_prefix` | Invoice number prefix |
| `invoice_counter` | Next invoice counter, DB-owned mutation |
| `draft_retention_days` | Shop-specific draft cleanup retention, default 30 |

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

Current implementation still uses `users.role` for much of the UI and RLS role gating. `shop_memberships.role` exists and is the long-term per-shop authority model.

Canonical direction:

- `users.role` remains a compatibility/default role until fully migrated.
- `shop_memberships.role` should govern shop-scoped authority over time.
- Shop admins can update their own shop configuration.
- A separate platform-admin role is not implemented unless explicitly modeled in a future spec.

## 8. Remaining Work

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

## 9. Out Of Scope For This Milestone

- Shop switching UI.
- Multi-shop membership selector.
- Billing/subscription enforcement.
- Platform-admin console unless separately modeled.
- Receipt layout customization beyond moving receipt data to `shops`.
- Moving exchange-rate API keys to Edge Function secrets; this remains a documented follow-up.

---

## Historical Context: Pre-2026-06-20 State

The original version of this document described the app as single-tenant with no `shop_id` isolation. That was accurate before the shop_id foundation migration and ADR-003. It is retained here only as historical context: the risk it identified was resolved by adding `shops`, `shop_memberships`, default `shop_id` columns, and supporting indexes. Future work should use the current sections above as the source of truth.