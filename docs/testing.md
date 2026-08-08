# Testing — CoffeeShop POS

## Commands
- `npm run test:unit` — Vitest unit/component tests (jsdom, `src/test/setup.ts`)
- `npm run test:db` — pgTAP DB tests (`supabase db test`; files in `supabase/tests/`)
- `npm run typecheck` — `tsc --build`
- `npm run test:e2e` — Playwright (`tests/e2e/`)
- `npm run check:schema` — schema drift check

## Env files
- `.env.test` / `.env.test.local` — Vitest loads these via test mode (default `vitest` mode = `test`)
- Vite loads `.env.{mode}` files; `.local` variants override and are gitignored

## DB tests
- `supabase/tests/rls_tenant_isolation.test.sql` (9 tests)
- `supabase/tests/rls_priority2_core.test.sql` (24 tests)

## Seed accounts
- `supabase/seed.sql` — gitignored; platform admin + tier test accounts (see file header for creds)
- `supabase/seed-demo-data.sql` — demo/product data

## DB reset
- `supabase db reset` (applies migrations + seed)
