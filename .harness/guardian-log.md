# Guardian Verdict Log

## Migration: `20260730160000_approve_shop_atomic_rpc.sql`

**Date:** 2026-07-30
**Agent:** db-guardian

**Verdict:** Proceed with caution — blocking issue (missing shop_id filter) was present in the design prompt but NOT in the actual implementation. The implementation uses `WHERE id = v_membership.id` after a shop-scoped SELECT with `FOR UPDATE`.

**Passed checks:**
- All referenced columns exist in LIVE schema
- audit_logs.actor_id type = uuid ✅
- audit_logs.details type = jsonb ✅
- CHECK constraints satisfied ('free', 'platform_admin', 'admin' all valid)
- No RLS recursion risk (SECURITY DEFINER bypasses RLS)
- SET search_path = '' present ✅
- REVOKE FROM anon, authenticated present ✅
- Naming conventions consistent ✅
- Atomicity (implicit in PL/pgSQL function) ✅

**Log entry:** Safe to proceed.

---

## Live DB Push Test: `20260730160000_approve_shop_atomic_rpc.sql`

**Date:** 2026-07-30
**Test:** `supabase db push` (live)
**Result:** ✅ Passed — no errors

**Verification:**
- `pg_proc.proname = 'approve_shop'` — ✅ Function exists, SECURITY DEFINER (prosecdef = true)
- `proacl` — ✅ REVOKE confirmed: only `postgres` and `service_role` have EXECUTE. No `anon`/`authenticated`.
- Function body verified — contains all 3 UPDATEs + audit INSERT + error validations
- No `public.current_shop_ids()` prefix used (not referenced in this migration)
- No RLS policies in this migration (function-only)

**Outcome:** ✅ Migration tested successfully — ready for PR.

---

## db-guardian Verdict: `20260731150000_harden_users_rls_policies.sql`

**Date:** 2026-07-31
**Operation:** P0 users RLS hardening (G1 INSERT pin + G2 UPDATE with_check)
**Guardian verdict:** ✅ **Safe to proceed** (v3 report, 3 rounds)
**Live schema verified:** YES (pg_policies, pg_proc, pg_trigger)
**Gaps closed:**
- G1: INSERT pinned to `id = auth.uid()` — no arbitrary role/shop_id self-registration
- G2: UPDATE `with_check` non-null — cashier cannot self-set role to admin; admin cannot self-promote (`id <> auth.uid()`)
- kokoe131986 (platform_admin w/ membership) escalation path closed (platform_admin ≠ admin branch)
**Non-blocking flags (separate follow-up):**
- kokoe131986 still holds a VISION §4.3 violation (platform_admin WITH membership) — data cleanup deferred to Ko Htun
- `users.role` remains admin source for user management (not memberships) — deliberate, preserves live semantics
**No RLS recursion** (admin-branch pattern byte-identical to live USING, self-scoped on auth.uid())

---

## db-guardian Verdict: `20260731151000_fix_users_update_policy_recursion.sql`

**Date:** 2026-07-31
**Operation:** HOTFIX — live 42P17 recursion on users UPDATE policy
**Incident:** 20260731150000 introduced WITH CHECK referencing public.users directly → ERROR 42P17 infinite recursion on ALL client users UPDATEs (UserModal/UserManager broken).
**Guardian verdict:** ✅ **Safe to proceed** (v4, with mandatory GRANT EXECUTE added)
**Root cause:** PostgreSQL re-applies RLS to self-table subqueries inside UPDATE policy; self-scoping on auth.uid() does NOT satisfy the recursion detector.
**Fix:** Route privilege + immutable-field checks through 3 SECURITY DEFINER helpers (users_get_own_role/active/shop_id), self-scoped to auth.uid(), SET search_path='', GRANT EXECUTE to authenticated. No direct `users` reference remains in the policy.
**Confirmed:** G1/G2/admin-self-promotion/kokoe escalation all remain closed; legit admin flows preserved.
