# Product Roadmap — CoffeeShop POS

Date: 2026-06-18
Commits referenced: `8556dc3`, `25da4db`, `64e0082`

---

## Resolved / Completed

### ✅ Payment Filter Dropdown — Stale Options (Resolved 2026-06-17)

**Bug:** `src/components/transactions/TransactionsManager.tsx:205-212` — payment filter `<select>` had only old generic options (`cash`, `card`, `digital`, `credit`), missing Myanmar local payment methods already defined in `Payment.method` and already rendered in `CheckoutModal.tsx`.

**Fix:** Added 5 missing `<option>` elements matching `CheckoutModal.tsx` payment buttons: `kbzpay`, `wavepay`, `ayapay`, `cbpay`, `mpu`.

**Note:** `CheckoutModal.tsx` still renders both old and new payment methods side-by-side. Future PR should decide whether to consolidate `digital` into local options or keep both tiers.

### ✅ PWA Conversion — Option A Soft-Offline (Resolved 2026-06-17)

**Decision:** Option A (Soft-offline) — installable iPad app with cached UI shell, cart survives refresh.

**Implementation:**
- Installed `vite-plugin-pwa` with `generateSW` strategy (precache + runtimeCaching)
- 41 precache entries: JS, CSS, HTML, icons, PNG, SVG
- Google Fonts cached via `CacheFirst` (1-year expiry)
- Supabase API calls cached via `NetworkFirst` (5-second timeout, 5-minute expiry)
- `registerType: 'autoUpdate'` — new SW auto-activates on next page load
- Fixed `site.webmanifest`: name, short_name, theme_color (`#473b32`), background_color (`#faf8f5`), orientation (`landscape`), maskable icon
- Fixed `<link rel="icon">` from broken `/vite.svg` → `/favicon-32x32.png`
- Cart persistence: `CART_STORAGE_KEY` in localStorage, auto-saved on every cart/selectedCustomer change, auto-restored on mount

**Remaining (post-beta):** Upgrade to Option C (offline checkout queue) based on real shop connectivity data.

### ✅ Security Audit Remediation — Phase 1 (Resolved 2026-06-18)

**Commit:** `64e0082`. Supabase Security Advisor findings addressed across 4 migrations:

1. **Users INSERT fix** — Policy had `WITH CHECK(true)`, allowing any authenticated user to insert any role (incl. admin). Replaced with `WITH CHECK(auth.uid() = id)` — users can only insert their own profile row.

2. **rls_auto_enable() harden** — SECURITY DEFINER function was callable by `anon` and `authenticated` via `/rest/v1/rpc/rls_auto_enable`. EXECUTE revoked from both roles. Now `service_role` + `postgres` only.

3. **Currency tables RLS** — `currency_config`, `exchange_rates`, `exchange_rate_history` had blanket `auth.role()='authenticated'` FOR ALL policies. Cashiers could modify exchange rates. Now role-gated: SELECT for all authenticated, write for admin/manager only.

4. **Function search_path** — All 7 public functions (`update_updated_at_column`, `generate_invoice_number`, `update_customer_stats`, `auto_generate_invoice_number`, `get_current_exchange_rate`, `convert_currency_amount`, `update_exchange_rate`) received `SET search_path = ''`. Eliminates search-path injection vector (Supabase advisory #0011).

**Remaining (manual):** Leaked password protection enabled in Supabase Dashboard → Authentication → Settings.

### ✅ Performance Optimization — Sales Pagination + Batch Lazy-Load (Completed 2026-06-18)

- `salesService.getAll()` now cursor-based: accepts `{ limit = 50, cursor = 0 }`, returns `{ data, count, hasMore }`. Uses `.range()` + lightweight `count(head: true)` query. Initial load at `SupabaseAppContext` uses `.then(r => r.data)`.
- `productsService.getAll()` no longer fetches nested `product_batches (*)`. Returns empty `batches: []`.
- New `productsService.getBatchesByProductId(id)` — lazy-loads batches on demand (called from `ProductModal` edit form).

### ✅ Responsive Layout — Tablet Sidebar + Mobile Dashboard Guard (Completed 2026-06-18)

- Cart: `flex-1` → `flex-shrink-0` with `md:w-64 lg:w-80/96` (fixed-width sidebar, no flex competition with ProductGrid).
- ProductGrid: added `min-w-0` to prevent overflow; image containers use `aspect-square` for zero-shift loading.
- `POSTerminal`: mobile guard — if `<768px` and role ≠ cashier, renders `ReportsManager` (dashboard) instead of POS.
- `Header`: POS nav item hidden on mobile for non-cashiers.
- Removed mobile FAB + bottom sheet cart (no longer needed — mobile shows dashboard).

---

## Short-Term Roadmap

Features needed for beta in real coffee shop.

### 1. Localization (i18n) — English / Myanmar

**Status:** Scoping needed.

Coffee shop in Myanmar → baristas need Myanmar language UI. Customers may see receipts in either language. Owners likely prefer English for reports.

**Scope questions to resolve:**
- Which UI surfaces need both languages? (All menus/labels vs. POS terminal only)
- Receipt language — per-customer preference or global toggle?
- What i18n library? `react-i18next` (most popular, 3.5M weekly downloads) vs. `react-intl` (FormatJS, heavier but ICU message format) vs. lightweight custom context
- Who translates? Need native Myanmar speaker to review machine translations
- RTL not needed (Myanmar is LTR script)

**Technical approach (recommended):**
- `react-i18next` + `i18next` with JSON namespace files (`en.json`, `my.json`)
- `LanguageContext` similar to existing `ThemeContext` pattern
- Language persisted in `localStorage` + `app_settings` DB row
- No language-specific CSS needed (LTR for both)

**Effort:** 2-3 days (library setup + key extraction + translation), after scope decision.

### 2. Food Costing Module — Ingredients, Recipes, Theoretical COGS

**Status:** Scoping complete. MVP defined. Awaiting implementation.

**Problem:** Coffee shop owners don't know true profit per drink. `Product.cost` is a single manual number — no ingredient-level breakdown, no automatic recalculation when vendor prices change.

**MVP Scope** (from PM brainstorm):

| Entity | What it does |
|---|---|
| `Ingredient` | Raw purchased item (beans, milk, syrup). Tracked in its own unit (kg, L, pcs). Has `currentCost`, `costHistory`, `stockOnHand` |
| `Recipe` | Links one `Product` → many `RecipeLine`s. Computes `theoreticalCost` = sum of (ingredient qty × cost × wastage%). Optional `laborCostPerUnit` + `overheadPercent` |
| `RecipeLine` | One ingredient in a recipe: quantity, unit, `wastagePercent` (default 5%), `isOptional` flag |
| `WasteLog` | Manual waste entry: ingredient, quantity, reason (spill, expired, burnt batch). Feeds actual COGS |

**What MVP delivers:**
- Ingredient CRUD (table + modal, follows existing Manager/Modal component pattern)
- Recipe CRUD — assign ingredients to products, set quantities, auto-compute `theoreticalCost`
- `Product.cost` becomes read-only, computed from its recipe
- Cost display on product detail (margin = price − theoreticalCost)
- Manual waste logging

**Integration with existing system:**
- Existing `Product.trackInventory` stays — controls POS stock deduction
- Existing `ProductBatch` (supplier batches with expiry) feeds `Ingredient.costHistory`
- Existing weight-based logic (`isWeightBased`) reused for ingredients sold by weight
- Recipe costing for weight-based products uses per-kg yield

**Deferred to v2:** `PrepBatch` (sub-recipe production runs), inventory audit reconciliation, vendor-weighted average cost, unit conversion table.

**DB migration needed:** 4 new tables: `ingredients`, `recipes`, `recipe_lines`, `waste_logs`. New services: `ingredientsService`, `recipesService`, `wasteLogsService`. New types in `src/types/index.ts`.

**Effort:** 3-5 days (DB migration + types + services + 3 Manager/Modal component pairs + recipe cost computation + waste log).

---

## Long-Term — Technical Debt & Future Scope

Not blocking beta. Schedule after stabilization.

### 3. Technical Debt Register

Full details in `docs/technical-debt.md`. Summary:

| Item | Count | Effort |
|---|---|---|
| `any` type cleanup | 73 errors, 17 files | 3-4 hours |
| React Refresh context warnings | 26 warnings, 6 files | 1 hour |
| Color palette drift | 20+ inline hex values, ~10 files | 1-2 hours |

**Recommended cadence:** One debt item per sprint. Start with React Refresh splits (lowest risk, fixes dev experience). Then color palette formalization. Then `any` types (highest effort, spread across 2 sprints — `services.ts` first, then context files, then scattered.)

**Not on roadmap yet but surfaced in discussions:**
- Sales tab sharing between baristas
- Alert system wiring into navigation

### 4. Multi-Tenant Readiness — Gap Analysis

**Status:** Not yet scoped for implementation. Single-tenant only.

**Current state:** Zero tenant isolation. Every table (`products`, `customers`, `sales`, `users`, `discounts`, `sales_tabs`, `categories`, `suppliers`) has no `shop_id` column. RLS policies check role only — any authenticated user sees ALL data. A shop in Yangon can see sales from a shop in Colombo. Fine for one shop. Breaks for multiple.

#### Schema Overhaul — Every Core Table Needs `shop_id`

```sql
ALTER TABLE products ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE customers ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE sales ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE discounts ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE categories ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE suppliers ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
ALTER TABLE sales_tabs ADD COLUMN shop_id uuid NOT NULL REFERENCES shops(id);
```

#### New Tables Required

- **`shops`** — `id`, `name`, `address`, `phone`, `owner_id`, `subscription_tier`, `is_active`, `created_at`
- **`shop_memberships`** — `user_id`, `shop_id`, `role` (per-shop role, not global). A user could be admin at Shop A and cashier at Shop B.

#### RLS Rewrite — Every Policy Gets `AND shop_id = ...`

Current:
```sql
CREATE POLICY "Products viewable by all authenticated" ON products
  FOR SELECT USING (auth.role() = 'authenticated');
```

Must become:
```sql
CREATE POLICY "Products viewable by own shop members" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (
      SELECT shop_id FROM shop_memberships WHERE user_id = auth.uid()
    )
  );
```

Every policy on every table (~25 policies) needs this AND clause.

#### Auth Model Changes

- `users.role` becomes a global default, not per-shop authority. Move role decisions to `shop_memberships`.
- Supabase Auth has no built-in multi-tenant concept. Handle via `public.users` + `shop_memberships`.

#### Frontend Changes

- Shop selector on login (if user belongs to multiple shops)
- All service calls filter by `shop_id` implicitly (via RLS) or explicitly (via `.eq('shop_id', currentShopId)`)
- `app_settings` either scoped per-shop or shared with per-shop overrides

#### Migration Path

1. Create `shops` table, seed with default shop from existing data
2. Create `shop_memberships`, seed all existing users as members of default shop
3. Add `shop_id` columns (nullable initially)
4. Backfill all existing rows with default shop_id
5. Make `shop_id NOT NULL`
6. Rewrite all RLS policies
7. Update frontend service layer
8. Add shop selector UI

**Estimated effort:** 2-3 weeks full-time (schema + RLS + frontend).

**Alternative if managing < 5 shops:** Create one Supabase project per shop instead of implementing full multi-tenant. Simpler to maintain, harder to scale past ~10 shops (migration sync pain). Migrate to full multi-tenant when cross-shop reporting becomes a requirement.

---

## Priority Order

```
1. i18n scoping + impl                ← NEXT (2-3 days, needed for Myanmar beta)
2. Food Costing module                ← HIGH (3-5 days, profit tracking for beta)
3. Security Audit Phase 2             ← PRE-LAUNCH (app_settings single-row, alert tables, partial index)
4. React Refresh warnings             ← POST-BETA (1 hour, dev experience)
5. Color palette formalization        ← POST-BETA (1-2 hours, visual polish)
6. any type cleanup                   ← POST-BETA (3-4 hours, type safety)
7. Multi-tenant readiness             ← GROWTH (2-3 weeks, when onboarding second shop)
```

---

## Appendix A: Monthly Database & Security Maintenance Checklist

**Run first Monday of every month.**

### Week 1 — Auth Audit

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

### Week 2 — RLS & Database Audit

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
- [ ] **Audit RLS policies for all 13 tables**: each table should have at least SELECT + INSERT/UPDATE/DELETE matching the role hierarchy defined in `20260618000001_role_aware_rls_security.sql`.
- [ ] **Row count sanity**: query each table. Spikes in `sales` should match known activity.

### Week 3 — Backup & Recovery

#### Manual Secure Backup Procedure

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

### Week 4 — Monitoring & Credential Hygiene

- [ ] **Supabase → Logs → Postgres Logs**: search for `ERROR`, `permission denied`, `policy violation`. Each = someone trying to access data they shouldn't.
- [ ] **Auth → Logins**: sort by timestamp descending. Unexpected IPs or unusual hours?
- [ ] **API → Usage**: spike in REST API calls? Check path breakdown — a spike in `/rest/v1/rpc/` could indicate probing.
- [ ] **Database → Query Performance**: any query suddenly scanning instead of index-seeking?

#### Credential Management

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

- Decision gate: one Supabase project per shop (simpler, harder to manage at scale) vs. full multi-tenant (see Section 4 above).
- Consider Supabase Organizations for access/billing separation.
- Implement audit logging: `activity_log` table (`user_id`, `action`, `table_affected`, `old_values`, `new_values`, `timestamp`). Feed into monthly review.
