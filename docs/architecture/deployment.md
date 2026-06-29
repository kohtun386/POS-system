# Deployment Architecture — CoffeeShop POS

**Supabase project ref:** `ejvvwnupiqytximrbmfw`
**Last updated:** 2026-06-29 (aligned with VISION.md v3.0.0)

---

## 1. Environment Variables

### 1.1 Client-Side (Vite `VITE_` prefix — inlined into JS bundle)

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| `VITE_SUPABASE_URL` | Yes | `.env` | Supabase project URL. Format: `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | `.env` | Supabase anonymous/public key. Safe to expose in client bundle. |

### 1.2 Server-Side / CLI (NOT in client bundle)

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| `SUPABASE_ACCESS_TOKEN` | For CLI ops | `.env` | Supabase personal access token. Used by `supabase` CLI and MCP tools. |
| `SUPABASE_PROJECT_REF` | For CLI ops | `.env` | Project reference ID: `ejvvwnupiqytximrbmfw` |
| `SUPABASE_URL` | For Edge Functions | `.env` | Same as VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never in client** | `.env` | Service role key bypasses RLS. Use only in Edge Functions or server-side scripts. |

### 1.3 .gitignore Coverage

```
.env              — gitignored ✅
.mcp.json         — gitignored ✅ (may contain env var references)
.vercel           — gitignored ✅
node_modules      — gitignored ✅
dist              — gitignored ✅
```

**Rule:** `.env` file must NEVER be committed. Only `.env.example` (with placeholder values) should be in repo.

---

## 2. Local Development Setup

### 2.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18.x | Runtime |
| npm | ≥ 9.x | Package manager |
| Supabase CLI | Latest | Local dev, migrations, Edge Functions (optional) |

### 2.2 Quick Start

```bash
# 1. Clone repository
git clone <repo-url>
cd coffee-pos

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env   # If .env.example exists, otherwise create manually:
# VITE_SUPABASE_URL=https://ejvvwnupiqytximrbmfw.supabase.co
# VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 4. Start dev server
npm run dev
# → http://localhost:5173 (Vite default, --host flag exposes on network)
```

### 2.3 Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite --host` | Start dev server with HMR. Accessible on local network (iPad testing). |
| `npm run build` | `vite build` | Production build to `dist/` |
| `npm run preview` | `vite preview` | Preview production build locally |
| `npm run lint` | `eslint .` | Run ESLint across all source files |

### 2.4 Supabase CLI (Optional — for local Supabase)

```bash
# Initialize local Supabase (if not done)
supabase init

# Link to remote project
supabase link --project-ref ejvvwnupiqytximrbmfw

# Pull remote schema
supabase db pull

# Create new migration
supabase migration new <migration_name>

# Apply migrations to remote
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > src/lib/database.types.ts
```

---

## 3. Supabase Project Configuration

### 3.1 Project Details

| Property | Value |
|----------|-------|
| Project ref | `ejvvwnupiqytximrbmfw` |
| Region | (check Supabase dashboard) |
| Database | PostgreSQL 15+ |
| API | REST (PostgREST) + Realtime (unused currently) |
| Auth | Email/password enabled |
| Storage | Unused currently |

### 3.2 Auth Settings (Manual — via Supabase Dashboard)

| Setting | Location | Recommended Value |
|---------|----------|-------------------|
| Email confirmation | Dashboard → Auth → Settings | Enabled for production, disabled for dev |
| Password strength | Dashboard → Auth → Settings → Password Strength | "Strong" |
| Leaked password protection | Dashboard → Auth → Settings | Enabled |
| MFA | Dashboard → Auth → Multi-Factor | Enable for admin accounts |
| Rate limiting | Dashboard → Authentication → Rate Limits | Enable for production |
| Session timeout | Dashboard → Auth → Settings | Default (1 hour access token) |

### 3.3 Database Extensions

Enabled in migrations:
- `uuid-ossp` — UUID generation
- `pgcrypto` — Cryptographic functions

### 3.4 RLS Status

All tables (18+) have RLS enabled. See `docs/architecture/database.md` for full policy matrix.

---

## 4. Build & Deploy

### 4.1 Production Build

```bash
npm run build
# Output: dist/ directory
# Vite handles: tree-shaking, code-splitting (lazy routes), asset hashing
```

**Code splitting:** All route components lazy-loaded via `React.lazy()`. Separate chunks for POS, transactions, inventory, customers, reports, settings, discounts, users.

### 4.2 PWA Configuration

Configured in `vite.config.ts` via `vite-plugin-pwa`:

| Setting | Value | Notes |
|---------|-------|-------|
| `registerType` | `autoUpdate` | New service worker auto-activates |
| `includeAssets` | favicon, icons | Precached |
| `manifest.name` | "CoffeeShop POS" | |
| `manifest.short_name` | "CoffeePOS" | |
| `manifest.theme_color` | `#473b32` | Espresso dark |
| `manifest.background_color` | `#faf8f5` | Cream |
| `manifest.display` | `standalone` | Full-screen app feel |
| `manifest.orientation` | `landscape` | iPad POS optimized |

**Workbox caching strategies:**

| Resource | Strategy | Cache Name | Expiry |
|----------|----------|------------|--------|
| App shell (JS/CSS/HTML) | Precache | (default) | Permanent until new deploy |
| Google Fonts CSS | CacheFirst | `google-fonts-cache` | 1 year |
| Google Fonts files | CacheFirst | `google-fonts-static-cache` | 1 year |
| Supabase API | NetworkFirst | `supabase-api-cache` | 5 min, 100 entries, 5s timeout |

### 4.3 Deployment Targets

**Option A: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Production deploy
vercel --prod
```

Vercel auto-detects Vite. No build configuration needed.

**Option B: Netlify**

```bash
# Build command: npm run build
# Publish directory: dist
# Set env vars in Netlify dashboard
```

**Option C: Static hosting (any)**

```bash
npm run build
# Upload dist/ to any static host (S3, Cloudflare Pages, GitHub Pages)
```

### 4.4 Deployment Checklist

- [ ] `.env` variables set in hosting platform (Vercel/Netlify dashboard)
- [ ] `npm run build` succeeds without errors
- [ ] `npm run lint` passes
- [ ] Supabase migrations applied (`supabase db push` or dashboard)
- [ ] Service worker registered (check Application tab in DevTools)
- [ ] PWA installable on target device (iPad "Add to Home Screen")
- [ ] HTTPS enabled (required for PWA + service worker)
- [ ] Supabase Auth settings configured (see 3.2)
- [ ] Leaked password protection enabled
- [ ] Admin account created with strong password

---

## 5. Edge Functions (Platform Admin)

Platform admin operations use Supabase Edge Functions with the `service_role` key — zero direct database access from the platform admin UI (VISION.md §17).

### 5.1 Architecture

```
Platform Admin UI (React)
  → supabase.functions.invoke('platform-admin-...')
    → Edge Function (service_role key)
      → Direct Postgres access (bypasses RLS)
        → Response returned to client
```

**Why:** `service_role` key never exposed to client bundle. RLS policies remain clean — no `OR role = 'platform_admin'` exceptions.

### 5.2 Edge Function Inventory

| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activate shop + membership + user |
| `platform-admin-reject-shop` | Deny pending shop application |
| `platform-admin-update-subscription` | Change shop subscription_tier |
| `platform-admin-list-shops` | List all shops with status |
| `platform-admin-get-shop-detail` | Full shop + owner + membership info |
| `platform-admin-manage-features` | Update feature_definitions rows |
| `platform-admin-daily-stats` | Platform-wide metrics (MRR, active shops) |

### 5.3 Deploying Edge Functions

```bash
# Serve locally for development
supabase functions serve platform-admin-approve-shop

# Deploy to production
supabase functions deploy platform-admin-approve-shop

# Deploy all functions
supabase functions deploy
```

### 5.4 Subscription Billing Architecture

**Model:** Manual High-Touch (VISION.md §3.4)

No automated billing integration (no Stripe, no payment gateway). Billing flow:

1. Customer contacts Ko Htun (phone/Viber/WhatsApp)
2. Ko Htun confirms tier and duration
3. Customer transfers payment via KBZpay / AYApay / UABpay / MMQR
4. Ko Htun verifies payment receipt
5. Ko Htun activates subscription in Platform Admin UI (`platform-admin-update-subscription`)
6. Customer notified

**Grace period:** 5 days after subscription expiry. Shop remains fully functional. After grace, automatic downgrade to Free tier features. No data deleted.

---

## 6. Supabase MCP / CLI Access

### 6.1 MCP Configuration

Supabase MCP tools available via `.mcp.json` (gitignored). Requires `SUPABASE_ACCESS_TOKEN` environment variable.

Tools available:
- `execute_sql` — Run arbitrary SQL
- `apply_migration` — Create new migration
- `list_tables` — Get schema info
- `get_advisors` — Security/performance advisors
- `list_migrations` — View migration history
- `get_logs` — Query service logs

### 6.2 CLI Configuration

```bash
# Login
supabase login

# Link project
supabase link --project-ref ejvvwnupiqytximrbmfw

# Common commands
supabase db push                    # Apply pending migrations
supabase db pull                    # Pull remote schema changes
supabase migration new <name>       # Create new migration file
supabase gen types typescript       # Generate TS types from remote schema
supabase functions serve            # Serve Edge Functions locally
supabase functions deploy <name>    # Deploy Edge Function
```

---

## 7. Monitoring & Logs

### 7.1 Supabase Dashboard Logs

| Log Type | Location | Use |
|----------|----------|-----|
| Postgres logs | Dashboard → Logs → Postgres | Query errors, permission denied, slow queries |
| API logs | Dashboard → Logs → API | HTTP request/response, 4xx/5xx errors |
| Auth logs | Dashboard → Authentication → Logs | Login attempts, signups, failures |
| Edge Function logs | Dashboard → Logs → Edge Functions | Function execution, errors |

### 7.2 Vercel Analytics (if deployed on Vercel)

- Web Vitals: LCP, FID, CLS
- Page load times
- Geographic distribution

### 7.3 Maintenance Schedule

See `docs/ops/maintenance-checklist.md` for monthly routine:
- Week 1: Auth audit
- Week 2: RLS & database audit
- Week 3: Backup & recovery verification
- Week 4: Monitoring & credential hygiene

---

## 8. Backup & Recovery

### 8.1 Supabase Automatic Backups

Supabase Pro plan: daily automatic backups, 7-day retention. Check Dashboard → Database → Backups.

### 8.2 Manual Backup

```bash
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

# Encrypt
gpg --symmetric --cipher-algo AES256 coffee-pos-backup-$(date +%Y-%m-%d).dump

# Upload to off-site storage (S3, Google Drive)
```

### 8.3 Restore

```bash
gpg --decrypt backup.dump.gpg | pg_restore --host=localhost --dbname=test_restore
```

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Anon key in client bundle | Expected. Anon key is public. RLS enforces access. |
| Service role key | Never in client bundle. Removed in security audit. Use Edge Functions for admin ops. |
| `.env` exposure | Gitignored. Pre-commit hook recommended: `git-secrets --scan` |
| Supabase URL in client | Expected. Public endpoint. RLS is the gate. |
| HTTPS required | PWA + service worker require HTTPS. Most hosts (Vercel, Netlify) provide by default. |
| Function search_path | All public functions use `SET search_path = ''`. Verified in migration `20260618000002`. |
| SECURITY DEFINER functions | `handle_new_auth_user()`, `rls_auto_enable()` — EXECUTE revoked from `anon` and `authenticated`. |

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| White screen after deploy | Missing env vars in hosting platform | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| "Failed to load user profile" | Auth user exists but `public.users` row missing | Run backfill SQL from migration `20260619000002` |
| Cart empty after refresh | localStorage cleared or `CART_STORAGE_KEY` changed | Check browser DevTools → Application → Local Storage |
| PWA not updating | Old service worker cached | DevTools → Application → Service Workers → Unregister |
| "Unauthorized" on MCP tools | `SUPABASE_ACCESS_TOKEN` not set | Set in `.env` or export in shell |
| Migration fails | Remote schema ahead of local | `supabase db pull` to sync, then retry |
| 403 on Supabase API | RLS policy blocking | Check `pg_policies` for table, verify role in `users` table |
| Slow queries | Missing index | Check `docs/architecture/database.md` index inventory, add if needed |
