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

### ✅ Multi-Tenancy Foundation — shop_id Placeholder (Completed 2026-06-20)

**Decision:** Add `shop_id` foundation before onboarding more shops.

**Implementation:**
- `shops` and `shop_memberships` tables created
- Tenant-scoped tables received `shop_id` with the default shop UUID
- `shop_id` indexes created for tenant-scoped access paths
- Default shop seeded for existing single-shop operation

**Remaining:** Dynamic per-shop configuration is the next milestone. `shops` will own business identity and POS behavior; `app_settings` will be trimmed to global/preferences-style settings.

### ✅ Documentation Reconciliation — Dynamic Shop Config Source Of Truth (Completed 2026-06-23)

**Decision:** Align docs before implementation so there is one canonical architecture.

**Canonical rules:**
- `shops` owns store identity, tax/currency behavior, invoice config, business type, and draft retention
- `app_settings` owns global/preferences-style settings only
- Invoice generation is atomic and database-owned per shop
- Instant signup access is deprecated in favor of Pending Approval
- Exchange-rate API keys remain in `app_settings` temporarily with documented security risk and future server-side secret migration

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

### Technical Debt Register

→ See `docs/specs/technical-debt.md` for full register:
- `any` type cleanup: 73 errors, 17 files (3-4 hours)
- React Refresh context warnings: 26 warnings, 6 files (1 hour)
- Color palette drift: 20+ inline hex values, ~10 files (1-2 hours)

**Recommended cadence:** One debt item per sprint. Start with React Refresh splits (lowest risk), then color palette, then `any` types.

**Not on roadmap yet but surfaced in discussions:**
- Sales tab sharing between baristas
- Alert system wiring into navigation

### Multi-Tenant Readiness

→ Full gap analysis moved to `docs/specs/multi-tenancy.md`.

Historical note: this section originally described the pre-2026-06-20 state when tenant isolation was not yet present. The `shop_id` foundation now exists. Current remaining work is dynamic shop configuration: move store identity, tax, currency, invoice config, business type, and draft retention into `shops`; trim `app_settings`; route invoice generation through the atomic DB function; and add pending approval gating.

---

## Priority Order

```
1. i18n scoping + impl                ← NEXT (2-3 days, needed for Myanmar beta)
2. Food Costing module                ← HIGH (3-5 days, profit tracking for beta)
3. Security Audit Phase 2             ← PRE-LAUNCH (app_settings single-row, alert tables, partial index)
4. React Refresh warnings             ← POST-BETA (1 hour, dev experience)
5. Color palette formalization        ← POST-BETA (1-2 hours, visual polish)
6. any type cleanup                   ← POST-BETA (3-4 hours, type safety)
7. Dynamic shop configuration         ← NEXT ARCHITECTURE MILESTONE
8. Monthly maintenance checklist      ← See docs/ops/maintenance-checklist.md
```
