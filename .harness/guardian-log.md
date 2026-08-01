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

---

## db-guardian Verdict: `20260731152000_constrain_users_self_insert.sql`

**Date:** 2026-07-31
**Operation:** Tighten users self-INSERT to unprivileged row (role='cashier' AND active=false)
**Source:** Code-review finding (valid) — INSERT pin left caller-controlled role unconstrained; self-insert of role='admin' would unlock the UPDATE admin branch.
**Guardian verdict:** ✅ **Safe to proceed** (v5)
**Closure:** Self-inserted row can never yield users_get_own_role()='admin' → admin branch never unlocks.
**No legit client INSERT into users** (trigger/EF/RPC all bypass RLS by design).
**Flagged (separate):** handle_new_auth_user() omits shop_id (NOT NULL, no default) — root cause; needs follow-up fix.

---

## db-guardian Verdict: `20260731160000_fix_users_shop_id_in_trigger.sql`

**Date:** 2026-07-31
**Operation:** CREATE OR REPLACE handle_new_auth_user() to populate users.shop_id (NOT NULL) in staff-creation + self-registration branches
**Source:** P0 — closes the "handle_new_auth_user() omits shop_id" flag above
**Guardian verdict:** ✅ **Safe to proceed** (revalidation, after BLOCKED v1)
**Blocked v1:** staff-create + staff-accept-invitation did NOT set shop_id in user_metadata → `(metadata ->> 'shop_id')::UUID` NULL → NOT NULL violation
**Fix:** added `shop_id` to user_metadata in both Edge Functions (staff-create + staff-accept-invitation Branch B)
**Exhaustive trigger-fire audit:** 3 auth-user creation paths (signUp self-reg, staff-create, accept-invite Branch B) all satisfy NOT NULL. Branch A (existing user) no trigger.
**Self-reg branch order-safe:** shops.owner_id has no FK (verified pg_constraint) → shops INSERT before users is legal.
**Companion change set:** migration + supabase/functions/staff-create/index.ts + supabase/functions/staff-accept-invitation/index.ts → PR #29.
**Closure:** previously-flagged shop_id omission resolved.

---

## db-guardian Verdict: security hardening — staff branch gates on app_metadata.staff_provisioned

**Date:** 2026-07-31
**Operation:** Re-applied `handle_new_auth_user()` so the staff branch is entered ONLY when `raw_app_meta_data ->> 'staff_provisioned'` is true (server-controlled).
**Source:** Code-review finding — the P0 trigger previously trusted caller-controlled `raw_user_meta_data.staff_creation`; a public signup could forge it to self-assign an ACTIVE admin/manager profile in an arbitrary shop (bypassing EF admin-JWT/tier/invitation checks).
**Guardian verdict:** ✅ **Safe to proceed** (post-deploy revalidation)
**Fix:** both Edge Functions set `app_metadata: { staff_provisioned: true }` via admin.createUser (staff-create v4, staff-accept-invitation v2). Public signup writes only raw_user_meta_data and cannot set app_metadata → escalation closed.
**Deploy order honored:** EFs re-deployed BEFORE the hardened trigger was re-applied (db-guardian BLOCKED until EFs were live, to avoid phantom-shop fallthrough).
**Confirmed:** live function gates on app_metadata; no existing user carries staff_provisioned (0 misclassification); trigger still wired on auth.users AFTER INSERT.
**Non-blocking:** dead `staff_creation: true` flag left in EF user_metadata; stale staff-create header comment.

---

## db-guardian Verdict: post-deploy revalidation — PR #29 (fix/users-shop-id-trigger)

**Date:** 2026-07-31
**Operation:** Revalidate live `handle_new_auth_user()` staff-branch gate, trigger wiring, remote-only migration `20260731162223`, user data, and local sync.
**Verdict:** ✅ Safe to proceed (post-deploy revalidation)

**Live function:** gates on `(NEW.raw_app_meta_data ->> 'staff_provisioned')::BOOLEAN` COALESCE false (NOT raw_user_meta_data.staff_creation). SECURITY DEFINER, `SET search_path=''`, matches local `20260731160000` byte-for-byte. proacl `{=X/postgres, ...}` — PUBLIC-granted EXECUTE not removed by the REVOKE (SQLite: REVOKE targets explicit user grants; function had no explicit anon/authenticated grant to revoke). Mitigation: SECURITY DEFINER + search_path='' + trigger never callable from client layer; still RECOMMENDED follow-up `ALTER FUNCTION ... OWNER TO postgres` to nullify default PUBLIC exec — non-blocking.
**Trigger:** `on_auth_user_created` AFTER INSERT ON auth.users, enabled, EXECUTE FUNCTION handle_new_auth_user().
**Drift `20260731162223` (remote-only, name security_harden_handle_new_auth_user_staff_gate):** Same hardened function body as the local file — NOT conflicting. It is the mechanism by which the hardened gate reached live. `supabase db push` will apply local `20260731160000` (CREATE OR REPLACE — idempotent, no-op effect) but will NOT re-run remote `20260731162223` (already applied remote; only 1 migration pending). The 20260731162223 row will persist in schema_migrations as remote-only — harmless, noted as cosmetic drift in `db push` output.
**No user corruption:** 0 users with app_metadata.staff_provisioned=true except smoke.cashier (intentional smoke test); 0 NULL shop_id (NOT NULL live); staff profile role=admin/membership role=cashier/active=false consistent with prior smoke-test state, not misclassified by the gate change.
**db push:** Not required — zero local migrations are pending (20260731160000 is applied on BOTH local and remote per `supabase migration list`; the only unmatched row is remote-only 20260731162223). `db push` would be a no-op. No schema conflict risk.

---

## db-guardian Verdict: `20260731170000_move_staff_auth_to_provision_user.sql`

**Date:** 2026-07-31
**Operation:** Move staff authorization from `handle_new_auth_user()` trigger into `provision_user()` RPC; real PUBLIC revoke on provision_user.
**Source:** PROVEN BROKEN — app_metadata.staff_provisioned gate is unreachable in an AFTER INSERT trigger (GoTrue writes app_metadata via post-INSERT UPDATE). Live smoke user fell through to Branch B → phantom shop + admin/inactive profile.
**Guardian verdict:** ✅ **Safe to proceed** (validated by live schema cross-check + real PostgreSQL 17 dry-run + 15 functional tests, all green)

**What it changes:**
- **Trigger staff branch**: gates on `raw_user_meta_data.staff_creation = 'true'` (string compare, present at INSERT). Inserts ONLY a dormant cashier profile (role='cashier', active=false, permissions=['pos_access']). No shop/membership. role/active HARDCODED → a forged staff_creation cannot escalate (previous hole closed by construction). Invalid/null shop_id → skip insert (safe, provision_user self-heals).
- **provision_user()** (new 6-arg signature, p_role→p_target_role + p_active): upserts public.users (role/active/shop_id), upserts shop_memberships (ALREADY_MEMBER now idempotent), deletes phantom fallthrough shop (strictly gated, exception-swallowed so cleanup never blocks provisioning).
- **Old 5-arg provision_user DROPPED** (was PUBLIC-executable latent overload). REVOKE ALL FROM PUBLIC + GRANT only to service_role.

**Validation performed (scratch Postgres 17 container, then dropped):**
- Migration compiles, idempotent re-run safe.
- anon/authenticated `has_function_privilege`=false, service_role=true.
- Exactly one provision_user signature (old 5-arg gone).
- Phantom cleanup: deletes smoke phantom shop + app_settings, cascades phantom membership; real membership created; role/active promoted.
- Legit pending OWNER shop (no staff_creation metadata) survives.
- Self-heal: user with no public.users row gets one upsert-created.
- Invitation flow: role from invitation, email binding enforced (mismatch rejected), token single-use.
- Real trigger E2E: dormant profile (0 shops, 0 memberships); self-reg path (admin/shop/membership all inactive); invalid shop_id → no abort.
- Cleanup failure path: provisioning still succeeds, phantom survives, `delete_phantom_shop_failed` audit logged.

**Not done by guardian (orchestrator):** EF updates (staff-create, staff-accept-invitation), type stub in database.types.ts, live db push, smoke test re-run.
**Non-blocking note:** `handle_new_auth_user` proacl ends at `{postgres=X/postgres}` after REVOKE ALL FROM PUBLIC — matches approve_shop hardening pattern.

---

## db-guardian Verdict: migration-history reconciliation for `20260731162223` (LegacyDbPushMissingLocalError)

**Date:** 2026-07-31
**Operation:** Validate local-mirror fix for `supabase db push` failure `LegacyDbPushMissingLocalError` (remote-only migration `20260731162223_security_harden_handle_new_auth_user_staff_gate` had no local file).
**Guardian verdict:** ✅ **Safe to proceed**

**1. Mirror file `20260731162223_security_harden_handle_new_auth_user_staff_gate.sql` — safe to re-run:**
- Executable SQL matches remote `schema_migrations.statements` byte-for-byte after comments/whitespace normalization (1644 chars both; normalized comparison == True). No transcription discrepancy.
- Idempotent: `CREATE OR REPLACE FUNCTION` + a REVOKE that is a no-op when the function has no explicit anon/authenticated grant (verified live proacl `{=X/postgres,...}` — PUBLIC grant remains; the REVOKE from named roles is inert). No DDL/DML side effects beyond function redefinition.
- Re-running it live would change nothing: the function it defines is byte-identical to what is already live (verified via `pg_get_functiondef`).

**2. Mirror vs `migration repair --status reverted`:**
- Mirror approach is more honest: the SQL DID run live (it is the mechanism by which the hardened gate reached prod). `repair --status reverted` marks the history row as if it never applied when it in fact did — history lies, and the row would still be inconsistent with what the function actually is.
- Mirror downsides to flag: (a) the file bakes a KNOWN-BROKEN function body into migration history (a reviewer re-running history later sees a superseded anti-pattern — acceptable, mitigated by the header comment explaining it is a mirror + superseded by 170000); (b) comment text differs slightly from remote (header comment is local-authored, explaining provenance) — the executable body is identical; (c) `schema_migrations.statements` for 62223 will remain the old text (db push does not rewrite the remote statements column — it only inserts the local row's new content when the migration is NEW; for an already-applied remote row the recorded statements stay as originally run). Cosmetic only; does not affect `db push` matching (matching is by version timestamp).

**3. Push plan is safe — no ordering hazard:**
- `npx supabase migration list` (CLI 2.111.0) confirms: `20260731162223` now shows as **matched (local + remote)**; only `20260731170000` is **pending**. Therefore `db push` applies ONLY `20260731170000`; the mirror is NOT re-executed (it is matched, not pending).
- The 20260731160000 branch of the push plan from the task prompt does not occur — 160000 is already applied on both local and remote. Net live delta = 170000 alone. Final state = new design. No ordering hazard.
- Even in the (unrealized) case both 62223 and 170000 were pushed, 62223's CREATE OR REPLACE is instantly superseded by 170000 in the same transaction-batched run; final state identical.

**4. RLS / security regression:**
- Mirror contains no RLS policy changes and no `current_shop_ids()` usage — no recursion risk (RLS checklist §18.2: no policy, no `current_shop_ids()` in any policy on shop_memberships).
- Live proacl confirms the REVOKE in the mirror cannot regress EXECUTE privileges (function has no explicit anon/authenticated grant to revoke; PUBLIC exec persists for the trigger function, but it is not client-invocable — `RETURNS TRIGGER`, called only by the AFTER INSERT trigger). The REAL fix to PUBLIC exec lands in 170000 (REVOKE ALL FROM PUBLIC on provision_user).
- No cross-tenant access introduced; SET search_path='' retained.

**Prerequisite before db push:** 170000 calls `provision_user(... p_target_role, p_active)` and DROPs the old 5-arg overload. Live currently has exactly ONE provision_user — the old 5-arg `(p_user_id, p_shop_id, p_invited_by, p_token, p_role)` signature, PUBLIC-granted. The EFs in the working tree (staff-create, staff-accept-invitation) are updated to the new signature in the same PR. Deploy order: db push (170000) and EF re-deploy must both land before the staff flow is exercised; otherwise EFs calling the new 6-arg signature would 42883 against the live 5-arg function. This is a runtime-ordering note for the orchestrator, not a blocker on the mirror itself.

**db push may proceed** once EFs are updated and deployed alongside. No schema conflict, no history mismatch remaining.

---

## db-guardian Verdict: `20260731171000_revoke_provision_user_from_anon_auth.sql`

**Date:** 2026-07-31
**Operation:** Follow-up revoke — close the anon/authenticated EXECUTE inherited from ALTER DEFAULT PRIVILEGES on the freshly-created 6-arg `provision_user`.
**Guardian verdict:** ✅ **Safe to proceed**

**Live state verified (before apply):**
- 6-arg `provision_user(uuid,uuid,uuid,text,text,boolean)` (oid 27443, prosecdef=true) proacl = `{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}`. Exactly one overload (no stale 5-arg).
- `pg_default_acl` has `postgres` grantor, defaclobjtype=`f`, defaclacl `{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — confirms the inheritance mechanism.
- Sibling shape check: `approve_shop` and `handle_new_auth_user` both already at target `{postgres=X/postgres, service_role=X/postgres}` — target ACL is the established pattern.

**1. Will REVOKE ... FROM anon, authenticated remove the inherited grants?** Yes. `REVOKE` targets the specific function's acl entry regardless of how it was granted (default-privileges inheritance happens once at CREATE; ALTER DEFAULT PRIVILEGES does not re-grant retroactively). The acl entry is per-function; removing the `anon`/`authenticated` members leaves `{postgres=X/postgres, service_role=X/postgres}`. Postgres 17 dry-run confirmed.

**2. Expected post-apply ACL:** `{postgres=X/postgres, service_role=X/postgres}`; `has_function_privilege(anon/authenticated, ...)` = false; `service_role` = true. No `=X/...` PUBLIC member.

**3. Future-function risk (FLAG — out of scope for this migration):** `ALTER DEFAULT PRIVILEGES` (postgres grantor, functions) will re-grant anon/authenticated EXECUTE on EVERY future function CREATEd under that default set (or REPLACEd when no explicit acl overrides it — verified on `handle_new_auth_user`: after a REVOKE is not re-inherited, but a newly-created function in a fresh statement would be). Any future SECURITY DEFINER RPC that does not explicitly REVOKE anon/authenticated after CREATE is exposed identically. This is the third function to need an explicit fixup (approve_shop, handle_new_auth_user, now provision_user). Recommend a separate follow-up to alter the default privileges (or mandate the revoke-immediately-after-create pattern) — NOT part of this migration's scope, per instruction.

**4. Push safety:** No ordering hazard (single standalone REVOKE on an already-existing function; no DDL dependency on later migrations). No drift — target ACL matches the established pattern. No RLS touch, no `current_shop_ids()` usage.

**5. File correctness:** Single `REVOKE ALL ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;` — exact identity matches live args. Header + verification comments accurate. Idempotent (second run is a no-op).

**Not done by guardian (orchestrator):** apply the migration live, then re-verify proacl + `has_function_privilege` per the file's VERIFICATION block.
**Non-blocking flag:** broad `ALTER DEFAULT PRIVILEGES` on functions remains a latent grant-leak for future RPCs (see #3).

---

## db-guardian Verdict: `20260731172000_fix_provision_user_preserve_primary_shop.sql`

**Date:** 2026-07-31
**Operation:** Follow-up fix — preserve existing user's primary shop (role/active/shop_id) when provision_user is invoked on a user who already has an ACTIVE membership in a DIFFERENT shop.
**Guardian verdict:** ✅ **Safe to proceed**

### Dry-run (scratch DB in local container, Postgres 17 — mirrors live)
Applied `170000` then `172000` in sequence to a fresh `scratch_guardian` DB (minimal mirror of shops/users/shop_memberships/shop_invitations/audit_logs + the 8 phantom-guard child tables; same FK shapes: fk_users_shop NO ACTION, membership UNIQUE(user_id,shop_id), role CHECKs). Then exercised `provision_user` for every edge case, re-provision idempotency, and the phantom-cleanup-when-promoted path. All PASS. Scratch dropped.

### Edge-case results
- **(a) Owner of Shop A accepts cashier invite to Shop B** — PASS. users row stays `admin`/active/`shop_id=A`; membership (user,B) added as `cashier`/active.
- **(b) Fresh dormant profile (invitation, zero memberships)** — PASS. Promoted to invitation role (`manager`)/active/`shop_id=B`.
- **(b2) No public.users row at all (trigger-skip edge)** — PASS. INSERT self-heals; promoted `cashier`/active/`shop_id=B`; exactly 1 membership. (Regression test not in the prompt; caught that the fix preserves this path.)
- **(c) Direct flow (staff-create, no token)** — PASS. v_promote_profile=true (no other-shop active membership), promoted.
- **(d) User with only an INACTIVE membership in another shop** — PASS. `NOT EXISTS (is_active=true)` is true → promotes. Inactive memberships do not block promotion (correct — the phantom cleanup also relies on `is_active=true` as the "real member" marker).
- **(e) Phantom shop + v_promote_profile=false** — PASS, safe fallback. users.shop_id FK to the phantom shop is NOT cleared (shop_id preserved), so `DELETE FROM shops` raises FK violation → caught by `EXCEPTION WHEN OTHERS` → `delete_phantom_shop_failed` logged → provisioning still succeeds. Verified: identity (admin, shop=PhantomP) preserved, phantom shop row intact, B membership added, failure log present. No data corruption; the phantom shop simply persists until an admin removes it (indirect — provisioning never blocks on it).
- **(f) `public.users.role` in DO UPDATE** — PASS. Compiles (Postgres 17: bare table name validly references the target row in DO UPDATE). Confirmed live and in scratch.

### Idempotency
Re-provisioning the same (user, shop) with a changed target role: v_promote_profile=false keeps primary identity (`admin`/shop A), and the 3b membership upsert refreshes in place (B membership updated to `manager`/active). No error, no drift.

### ACL / compile / push safety
- ACL re-assert is harmless: live `proacl` already `{postgres, service_role}` (post-171000); CREATE OR REPLACE preserves it; re-assert is a no-op. Verified in scratch: anon/authenticated = false, service_role = true.
- Migration state verified live: `170000` and `171000` are both applied; only `172000` is new. No overload-drop ordering hazard (the DROP FUNCTIONs live in 170000, already applied). `db push` applies only `172000`.
- No RLS/policy changes, no `current_shop_ids()` usage, SET search_path='' retained, SECURITY DEFINER retained, service_role-only grant. No schema-history mismatch.

### Open question (non-blocking)
The phantom-shop cleanup is now partially unreachable: it only fires when v_promote_profile=true (user's users.shop_id still points at the phantom). Since the trigger now writes dormant profiles with shop_id = the invited shop (not the phantom), the 3a repoint clears the FK only for those. A user who is primary elsewhere AND carries a phantom fallthrough shop keeps the phantom (FK blocks delete, logged `delete_phantom_shop_failed`). Safe — just note phantom rows may need a one-off platform-admin sweep, since the automated cleanup no longer reaches that combination.

### Not done by guardian (orchestrator)
Apply `172000` live, then re-verify proacl + `has_function_privilege` per the file's VERIFICATION block (expected anon/authenticated=false, service_role=true, no PUBLIC member).

## db-guardian verdict — 2026-08-01 — B1 scan phase (read-only)
- Verdict: BLOCKED (1 of 5 queries), safe after correction
- Live schema verified: YES
- Queries 1-4: SAFE — columns exist live, no writes, no RLS recursion (pg_policies verified)
- Query 5: ❌ `sales.name` does not exist live → use `sales.customer_name`
  Corrected: `SELECT id, customer_name, cashier FROM sales WHERE created_at >= date_trunc('day', now()) ORDER BY created_at DESC LIMIT 5;`
- Warnings: queries 1-3,5 are cross-shop scans; results depend on connector (authenticated RLS-scoped vs service_role bypass). Record which was used.
- types drift affecting this scan: NONE

---

## db-guardian verdict — 2026-08-01 — B1 fix re-verification & migration sync resolution

**Date:** 2026-08-01
**Operation:** Verify B1 fixes (daily_order_limit provisioning + checkout enforcement) are LIVE, and resolve the local-vs-remote migration sync mismatch (remote-only `20260801094135` vs local-only `20260801180000`).
**Guardian verdict:** ✅ **Safe to proceed / Safe to Merge**
**Live schema verified:** YES (via supabase-platform MCP `execute_sql`, elevated/owner, read-only; NOT RLS-scoped, NOT service_role)

### Migration sync state (`supabase migration list`, CLI 2.111.0)
- 69 versions total: 67 matched, 2 divergent.
  - **Remote-only:** `20260801094135`
  - **Local-only:** `20260801180000`
- **`20260801094135` IS the B1 migration.** name = `20260801180000_fix_daily_order_limit_provisioning`, statements **byte-for-byte match** the local `20260801180000` file (md5 of joined statements `d3232f38…` == local file md5 minus trailing newline; 7217 vs 7218 bytes). Contains all 3 fixes.
- `20260801180000` is **NOT** recorded in remote `schema_migrations` — the B1 content is live, but remote recorded it under `20260801094135`.

### Live DB verification (source of truth)
1. **`shops.daily_order_limit` default:** `'50'` ✅
2. **`checkout_complete`:** `FOR UPDATE` = yes · `shop_id = p_shop_id` filter = yes · `status = 'completed'` filter = yes · byte-match-with-local = yes (normalized) ✅
3. **`approve_shop`:** `daily_order_limit = 50` in UPDATE = yes · byte-match-with-local = yes ✅
4. **Backfill:** `SELECT count(*) FROM shops WHERE subscription_tier='free' AND daily_order_limit IS NULL` = **0** ✅ (all 5 free shops = 50 live)
5. **Signature stability:** both RPC signatures unchanged from pre-B1 shape → no Edge Function dependency hazard.
- Note: paid-tier shops show `daily_order_limit = 0` live — by design (`0` disables enforcement via `v_daily_limit > 0` guard), not a B1 defect.

### Sync resolution (tracking artifact, not a code gap)
- No `db push`, no `db pull` performed — B1 is fully live.
- **Action taken:** added local mirror `supabase/migrations/20260801094135_fix_daily_order_limit_provisioning.sql` (executable SQL identical to remote record; provenance header added) per the `20260731162223` precedent. This keeps `migration list` matched and prevents a future `LegacyDbPushMissingLocalError`. `db push` of `20260801180000` later is idempotent (CREATE OR REPLACE + idempotent DEFAULT/backfill) — a no-op on live.

**Outcome:** ✅ B1 fixes confirmed live; sync artifact resolved; ready for Ko Htun review/merge.
