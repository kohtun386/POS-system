# External Integrations

## APIs & Services

### Supabase (Primary Backend)

- **Purpose:** Database, authentication, Row Level Security, auto-generated REST API
- **Project ref:** `ejvvwnupiqytximrbmfw`
- **Client SDK:** `@supabase/supabase-js` ^2.50.5
- **Usage:** All data access goes through service objects in `src/lib/services.ts` which wrap `supabase.from()` calls. Auth handled via `supabase.auth` in `src/context/AuthContext.tsx`.
- **Key config:** `autoRefreshToken`, `persistSession`, `detectSessionInUrl` all enabled in `src/lib/supabase.ts`
- **Type safety:** Full TypeScript types generated from Postgres schema in `src/lib/database.types.ts`

### Exchange Rate APIs (Optional)

- **Purpose:** Currency conversion for multi-currency support
- **Providers supported:** Fixer.io, CurrencyLayer, exchangerate.host (configurable)
- **Implementation:** `src/lib/exchangeRateService.ts` fetches rates from the selected provider
- **Fallback:** Manual exchange rate entry if no API key configured
- **Config:** Provider and API key stored in `app_settings` table and accessed via env vars

### Google Fonts

- **Purpose:** Load DM Sans and Fraunces font families
- **Method:** `<link>` tags in `index.html` with `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`
- **Caching:** Service worker caches fonts for 1 year (Workbox `CacheFirst` strategy)

## Authentication

- **Provider:** Supabase Auth (built-in)
- **Strategy:** Email/password authentication
- **Session handling:** JWT-based with auto-refresh
  - `autoRefreshToken: true` -- tokens refresh automatically before expiry
  - `persistSession: true` -- session stored in localStorage
  - `detectSessionInUrl: true` -- handles magic link / email confirmation redirects
- **User profiles:** Stored in `public.users` table, auto-created on signup via database trigger (`20260619000002_auto_create_user_profile.sql`)
- **Role system:** Three roles (`admin`, `manager`, `cashier`) stored in `users.role` column
- **RLS:** Row Level Security on all tables, policies scoped by role and user

## Database

- **Type:** PostgreSQL (hosted on Supabase)
- **Connection method:** Supabase JS client over HTTPS (PostgREST)
- **Schema:** 18+ tables including `products`, `customers`, `sales`, `discounts`, `app_settings`, `users`, `sales_tabs`, `product_batches`, `shops`, `shop_memberships`, plus 5 alert-related tables
- **Migration strategy:** Sequential timestamped SQL files in `supabase/migrations/` (14 migrations from `20250804` through `20260620`)
- **RLS:** Enabled on all tables; policies use `auth.uid()` and role checks
- **Multi-tenancy:** `shop_id` column added to all tables (Phase 1 foundation, not yet actively scoped in RLS)

## Third-Party SDKs

| SDK | Version | Purpose |
|-----|---------|---------|
| `@supabase/supabase-js` | ^2.50.5 | Primary Supabase client (DB, auth, realtime) |
| `@supabase/auth-ui-react` | ^0.4.7 | Pre-built sign-in/sign-up UI components |
| `@supabase/auth-ui-shared` | ^0.1.8 | Shared styling for auth UI |
| `framer-motion` | ^11.0.0 | Animation library |
| `recharts` | ^2.12.0 | React charting library for reports |
| `lucide-react` | ^0.400.0 | Icon components |
| `sweetalert2` | ^11.22.2 | Modal/toast notifications |

## Environment Variables

All accessed via `import.meta.env.VITE_*` (Vite client-side env).

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project API URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public API key | Yes |
| `VITE_EXCHANGE_RATE_API_KEY` | API key for exchange rate provider | No |
| `VITE_EXCHANGE_RATE_PROVIDER` | Provider selection: `fixer`, `currencylayer`, or `exchangerate` | No (defaults to `exchangerate`) |

**Security note:** The `VITE_` prefix means these are inlined into the client bundle. The Supabase `service_role` key is intentionally excluded -- a comment in `src/lib/supabase.ts` documents that admin operations must use Edge Functions server-side.

## Integration Risks

### Single Points of Failure

- **Supabase:** The entire app depends on Supabase for database, auth, and API. If Supabase is down, the app is completely non-functional. No offline-first data layer exists (PWA caches static assets only, not data).
- **Network dependency:** All data operations require a live HTTPS connection to Supabase. The Workbox service worker caches Supabase API responses for only 5 minutes (`NetworkFirst` strategy).

### Vendor Lock-in

- **Supabase Auth:** Deeply integrated via `@supabase/auth-ui-react` and custom `AuthContext`. Migrating auth would require rewriting the context layer and login UI.
- **PostgREST:** All queries use Supabase's `.from().select()` chain. Migrating to a different database would require rewriting `src/lib/services.ts` entirely.
- **Row Level Security:** Authorization logic is in Postgres policies, not application code. Moving to another DB means reimplementing access control.

### Version Constraints

- **React 18.3:** Not yet on React 19. The `@supabase/auth-ui-react` package may have compatibility constraints with future React versions.
- **ESLint 9 flat config:** Uses the new flat config format. Plugin compatibility (react-hooks at rc.0) could break on upgrades.
- **No lockfile for engine versions:** No `.nvmrc` or `engines` field in package.json, so Node/npm versions are unconstrained across environments.
- **vite-plugin-pwa 1.3.0:** Depends on Workbox; service worker behavior changes could affect offline caching.

### Data Integrity

- **camelCase/snake_case mapping:** All field mapping is manual in `services.ts`. Adding new fields without updating both directions causes silent data loss.
- **No test suite:** Zero automated tests means integration regressions are caught only in manual testing.
