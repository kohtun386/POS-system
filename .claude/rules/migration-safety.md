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