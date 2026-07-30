# Monthly Database & Security Maintenance Checklist

**Run first Monday of every month.**

---

## Week 1 — Auth Audit

- [ ] **Review Auth Users**: Supabase Dashboard → Authentication → Users. Scan for unexpected email domains, duplicate accounts, accounts created outside your workflow.
- [ ] **Check `public.users` vs `auth.users` sync**:
  ```sql
  SELECT au.email, pu.id IS NULL AS missing_from_public
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;
  ```
  Orphaned auth users = someone signed up but got no profile row. Investigate and create profiles or delete the auth users.
- [ ] **Audit MFA status**: Dashboard → Authentication → Multi-Factor. Flag any admin accounts without MFA.
- [ ] **Review last login timestamps**: users with `last_login > 90 days` → disable.
- [ ] **Password policy**: Dashboard → Authentication → Settings → Password Strength. Confirm `Strong` is set.
- [ ] **Leaked password protection**: confirm still enabled (Dashboard → Authentication → Settings).
- [ ] **Rotate anon key** if exposed: Dashboard → API → regenerate. Update `.env` and redeploy.

---

## Week 2 — RLS & Database Audit

- [ ] **Verify all tables have RLS enabled**:
  ```sql
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = pg_tables.tablename AND p.schemaname = 'public'
  );
  ```
  Any table in the result → audit immediately.
- [ ] **Run Supabase Security Advisor**: Dashboard → Database → Security Advisor. Fix new `WARN` items within 48 hours.
- [ ] **Check for SECURITY DEFINER functions callable by clients**:
  ```sql
  SELECT proname FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = pg_namespace.oid
  WHERE n.nspname = 'public' AND prosecdef = true
  AND (proacl::text LIKE '%anon%' OR proacl::text LIKE '%authenticated%');
  ```
- [ ] **Audit RLS policies for all tables**: each table should have at least SELECT + INSERT/UPDATE/DELETE matching the role hierarchy.
- [ ] **Row count sanity**: query each table. Spikes in `sales` should match known activity.

---

## Week 3 — Backup & Recovery

### Manual Secure Backup Procedure

```bash
# 1. Generate time-stamped dump (requires Database Password from Dashboard → Database)
pg_dump \
  --host=db.ejvvwnupiqytximrbmfw.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=coffee-pos-backup-$(date +%Y-%m-%d).dump

# 2. Encrypt
gpg --symmetric --cipher-algo AES256 coffee-pos-backup-$(date +%Y-%m-%d).dump
# Store passphrase in password manager, not terminal history.

# 3. Upload encrypted file to off-site storage (S3, Google Drive — NOT your Supabase org)
```

- [ ] **Verify restore monthly**: decrypt and restore to local Postgres:
  ```bash
  gpg --decrypt backup.dump.gpg | pg_restore --host=localhost --dbname=test_restore
  # Spot-check: SELECT COUNT(*) FROM sales; matches expected
  ```
- [ ] **Export edge functions** from Dashboard if deployed.
- [ ] **Document backup location + passphrase recovery path** offline.

---

## Week 4 — Monitoring & Credential Hygiene

- [ ] **Supabase → Logs → Postgres Logs**: search for `ERROR`, `permission denied`, `policy violation`. Each = someone trying to access data they shouldn't.
- [ ] **Auth → Logins**: sort by timestamp descending. Unexpected IPs or unusual hours?
- [ ] **API → Usage**: spike in REST API calls? Check path breakdown — a spike in `/rest/v1/rpc/` could indicate probing.
- [ ] **Database → Query Performance**: any query suddenly scanning instead of index-seeking?

### Credential Management

| Practice | Now (1 shop) | Growth (5+ shops) |
|----------|-------------|-------------------|
| Anon key | In `.env`, `.gitignore`'d | Same, rotate quarterly |
| Service role key | NEVER in client bundle ✅ | Use Supabase Vault for edge functions |
| DB password | Supabase-managed | Rotate via Dashboard → Database → Reset password |
| API rate limiting | Not configured | Enable in Dashboard → Authentication → Rate Limits |
| Team access | You only | Supabase org member roles — never share credentials |
| Vercel env vars | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Same + edge function secrets in Vercel Environment Variables |
| `.env` file | `.gitignore`'d ✅ | Add pre-commit hook: `git-secrets --scan` |

### Growing Past 5 Shops

- Decision gate: one Supabase project per shop (simpler, harder to manage at scale) vs. full multi-tenant (see `docs/specs/multi-tenancy.md`).
- Consider Supabase Organizations for access/billing separation.
- Implement audit logging: `activity_log` table (`user_id`, `action`, `table_affected`, `old_values`, `new_values`, `timestamp`). Feed into monthly review.
