# Migration Safety Checklist (Multi-Tenant — VISION §18.2)

Every new/modified migration MUST satisfy:

- [ ] New tenant-scoped table has `shop_id UUID NOT NULL`
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present
- [ ] RLS policy uses `current_shop_ids()` helper for shop scoping
- [ ] Policy does NOT contain `OR users.role = 'platform_admin'`
      (VISION §4.3 — platform_admin bypasses via service_role only)
- [ ] Function has `SET search_path = ''` (injection hardening)
- [ ] `SECURITY DEFINER` functions are REVOKED from `anon`/`authenticated`
- [ ] Timestamps use `TIMESTAMP WITH TIME ZONE`
- [ ] No cross-tenant SELECT without explicit shop_id filter
- [ ] NEVER call `current_shop_ids()` in a policy ON `shop_memberships`
      (RLS recursion — PostgreSQL error 42P17)

## After Creating Any RLS Policy

- **Test each policy immediately after creation** — push the migration, then hit the affected endpoint and check for 500 errors. A policy that compiles may still cause infinite recursion or silently block access in production.
- **If 500 errors occur, check for RLS recursion on `shop_memberships` first** — this is the most common cause. PostgreSQL error 42P17. The `shop_memberships` table's RLS calls `current_shop_ids()`, which reads `shop_memberships` — if a policy on `shop_memberships` also calls `current_shop_ids()`, you get infinite recursion. This is the #1 debugging step when a migration compiles but produces 500s.

## db-guardian Agent (Mandatory)
BEFORE running ANY `supabase db *`, `docker exec psql`, or migration command:
1. Invoke `@db-guardian` to validate schema safety
2. Wait for "Safe to proceed" or "Proceed with caution" verdict
3. ONLY then execute the DB command
4. Log guardian verdict in `.harness/guardian-log.md`

## Atomicity (VISION §11)
- Multi-step writes MUST use a single RPC (PL/pgSQL function with BEGIN/COMMIT).
- Pattern: `checkout_complete()` (database.md §4) — all-or-nothing transaction.
- Edge Functions: NEVER do sequential `.from().update()` calls for critical paths.