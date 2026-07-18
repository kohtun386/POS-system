# Phase 3: Multi-Tenancy Hardening — Summary

**Date:** 2026-07-18
**Status:** ✅ Complete

---

## Quick Scan Results

### 1. RLS Policy Verification ✅
- **18 tables** with `shop_id` column — all have RLS enabled
- **Migration 20260717000002** successfully switched from `users.role` → `shop_memberships.role`
- **No policies** reference `users.role` directly (verified applied)
- **New tables** (purchase_logs, stock_items, stock_adjustments, audit_logs) have proper RLS

### 2. Service Layer shop_id Filtering
**Before:** 7 services relied solely on RLS (no explicit shop_id filter)
**After:** 5 services now accept optional `shopId` parameter for defense-in-depth

| Service | shop_id Filter | Notes |
|---------|---------------|-------|
| `productsService` | ✅ Added | `getAll(shopId?)` |
| `customersService` | ✅ Added | `getAll(shopId?)` |
| `salesService` | ✅ Added | `getAll({ shopId? })` |
| `discountsService` | ✅ Added | `getAll(shopId?)` |
| `settingsService` | ✅ Added | `get(shopId?)`, `update(settings, shopId?)` |
| `usersService` | ⏭️ Skipped | Users table has no shop_id (linked via shop_memberships) |
| `salesTabsService` | ⏭️ Skipped | Already filters by user_id (user-scoped) |

### 3. Edge Functions Authorization ✅
- **10 Edge Functions** — all use `service_role` key via `createAdminClient()`
- All functions call `verifyPlatformAdmin(req)` to verify platform_admin role
- Service role is never exposed to client (only used in Edge Functions)

### 4. Cross-Tenant Queries ✅
- No cross-tenant query issues found
- SalesTabs join customers correctly (user-scoped via RLS)

### 5. New Tables RLS ✅
| Table | RLS Status |
|-------|-----------|
| `purchase_logs` | ✅ RLS enabled |
| `stock_items` | ✅ RLS enabled |
| `stock_adjustments` | ✅ RLS enabled |
| `audit_logs` | ✅ RLS enabled, no policies = implicit deny (service_role only) |

---

## Issues Fixed

### Issue 1: Multi-Tenancy Leaks in Services (P2) ✅
**Problem:** 7 services didn't filter by `shop_id`, relying solely on RLS.

**Solution:** Added optional `shopId` parameter to 5 services for defense-in-depth:
- `productsService.getAll(shopId?)`
- `customersService.getAll(shopId?)`
- `salesService.getAll({ shopId? })`
- `discountsService.getAll(shopId?)`
- `settingsService.get(shopId?)` and `settingsService.update(settings, shopId?)`

**Files Updated:**
- `src/lib/services.ts` — Added shop_id filtering to 5 services
- `src/context/SupabaseAppContext.tsx` — Restructured data loading to get shop first, then pass shopId
- `src/components/reports/SimpleProfitReport.tsx` — Updated to pass shopId to salesService

### Issue 2: print_jobs Schema Drift (P2) ✅
**Problem:** TS `PrintJob` interface had 8 fields not in DB:
- `saleId`, `printerType`, `connectionType`, `printerAddress`, `payload`, `isReprint`, `retryCount`, `errorMessage`

**Solution:** Removed phantom fields from TS interface.

**DB Schema:**
```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL,
  order_id UUID,  -- Maps to orderId (not saleId)
  status TEXT CHECK (status IN ('pending', 'printing', 'completed', 'failed')),
  config_data JSONB,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

**Updated TS Interface:**
```typescript
export interface PrintJob {
  id: string;
  shopId: string;
  orderId: string;  // Fixed: was saleId
  status: PrintJobStatus;
  configData: Record<string, string | number | boolean>;
  createdAt: Date;
  completedAt?: Date;
}
```

### Issue 3: bogo Type Mismatch (P2) ✅
**Problem:** TS `Discount.type` allowed `'bogo'`, but DB CHECK constraint only allows `['percentage', 'fixed', 'free_gift']`.

**Solution:** Removed `'bogo'` from TS type (not implemented anyway).

**Updated Types:**
```typescript
export interface Discount {
  type: 'percentage' | 'fixed' | 'free_gift';  // Removed 'bogo'
}

export interface AppliedDiscount {
  type: 'percentage' | 'fixed' | 'free_gift';  // Removed 'bogo'
}
```

### Issue 4: Dead Column Cleanup (P3) ✅
**Problem:** `app_settings.currency` column exists but is never used (MMK-only per VISION.md §19).

**Decision:** Keep column (Option B) — harmless, dropping creates unnecessary migration.

**Action:** Updated `database.md` to document column as reserved for future use.

---

## Files Changed

| File | Changes |
|------|---------|
| `src/types/index.ts` | Fixed PrintJob interface, removed 'bogo' from Discount types |
| `src/lib/services.ts` | Added shop_id filtering to 5 services |
| `src/context/SupabaseAppContext.tsx` | Restructured data loading to pass shopId |
| `src/components/reports/SimpleProfitReport.tsx` | Updated to pass shopId to salesService |
| `docs/architecture/database.md` | Documented currency column as reserved |
| `multi-tenancy-audit-report.json` | Created audit report |

---

## Verification

- ✅ TypeScript check: No errors
- ✅ Tests: All 44 tests pass
- ✅ Schema drift: Clean (0 issues)
- ✅ RLS policies: All using shop_memberships.role

---

## Next Steps

1. **Commit changes** with descriptive message
2. **Test in browser** to verify data loads correctly with shop_id filtering
3. **Monitor** for any edge cases in multi-tenant data isolation
