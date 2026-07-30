# Guardian Log

## 2026-07-24 — Migration: fix_shop_memberships_select_recursion

**Verdict:** ✅ Safe to proceed
**Migration:** `20260724000001_fix_shop_memberships_select_recursion.sql`
**Operation:** Create 3 SECURITY DEFINER helper functions, drop & recreate all 4 shop_memberships policies
**Tables affected:** `shop_memberships` (policies only)
**Live schema verified:** YES
**database.types.ts drift:** NONE

**Key checks:**
- All 4 current policies verified as recursive (inline subqueries on shop_memberships)
- SECURITY DEFINER pattern: STABLE, read-only, SET search_path = '' — safe
- GRANT EXECUTE TO authenticated only
- DROP POLICY IF EXISTS / CREATE OR REPLACE — fully idempotent
- No column/table DDL — zero column risk

---

## 2026-07-26 — Migration: fix_checkout_complete_shop_id

**Verdict:** ✅ Safe to proceed
**Migration:** `20260726XXXXXX_fix_checkout_complete_shop_id.sql` (to be created)
**Operation:** Add `shop_id` column and `p_shop_id` value to `INSERT INTO sales` inside `checkout_complete` SECURITY DEFINER function
**Tables affected:** `sales` (via function INSERT)
**Live schema verified:** YES
**database.types.ts drift:** NONE

**Key checks:**
- `sales.shop_id` is `NOT NULL` with no default (confirmed by `20260726044400_remove_hardcoded_shop_id_defaults.sql`)
- Pattern consistent across `products.shop_id`, `customers.shop_id`, `discounts.shop_id`, `users.shop_id` — all `NOT NULL`, no default
- Current `checkout_complete` INSERT omits `shop_id` — confirmed via `pg_proc` source
- `p_shop_id` parameter is required UUID, validated by PostgREST before function executes, and used earlier in function for `daily_order_limit` check
- Function is `SECURITY DEFINER` — RLS on `sales` bypassed, no policy conflicts
- Other INSERT paths (seed script) already include `shop_id`
- Triggers fire AFTER INSERT, won't block
- No other callers affected

**No blockers. No warnings. Safe to apply.**

---

## 2026-07-30 — Diagnosis: shop_invitations schema drift P0

**Verdict:** False positive — table EXISTS in live DB. The schema drift check script has a bug.

**Diagnosis:** Table `shop_invitations` is documented in `database.md` (§7.10) and EXISTS in the live Supabase database (10 columns, RLS enabled, 0 rows). However, `database.types.ts` has NOT been regenerated since the migration that created `shop_invitations`. The drift script (`scripts/check-schema-drift.ts`, line 460) uses `Object.keys(tsSchema)` (i.e., tables from `database.types.ts`) as its proxy for "DB tables" instead of querying `information_schema.tables` directly. Since `shop_invitations` is not in the types file, `checkMissingTables()` reports it as missing from DB — a false positive.

**Root cause:** `database.types.ts` is stale (no `shop_invitations` entry). The drift script conflates "tables in TS types" with "tables in DB" — it doesn't actually query the live schema for the table existence check.

**Fix needed:** Regenerate types via `supabase gen types typescript --linked > src/lib/database.types.ts`. Optionally, also fix the drift script to query `information_schema` directly rather than relying on the types file as a proxy for DB state.