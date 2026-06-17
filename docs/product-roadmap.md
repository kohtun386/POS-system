# Product Roadmap — CoffeeShop POS

Date: 2026-06-17
Commits referenced: `8556dc3`, `25da4db`

---

## Resolved / Completed

### ✅ Payment Filter Dropdown — Stale Options (Resolved 2026-06-17)

**Bug:** `src/components/transactions/TransactionsManager.tsx:205-212` — payment filter `<select>` had only old generic options (`cash`, `card`, `digital`, `credit`), missing Myanmar local payment methods already defined in `Payment.method` and already rendered in `CheckoutModal.tsx`.

**Fix:** Added 5 missing `<option>` elements matching `CheckoutModal.tsx` payment buttons:
- `kbzpay` → KBZpay
- `wavepay` → WavePay
- `ayapay` → AYA Pay
- `cbpay` → CB Pay
- `mpu` → MPU

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

---

## Priority Order

```
1. i18n scoping + impl                ← NEXT (2-3 days, needed for Myanmar beta)
2. Food Costing module                ← HIGH (3-5 days, profit tracking for beta)
3. React Refresh warnings             ← POST-BETA (1 hour, dev experience)
4. Color palette formalization        ← POST-BETA (1-2 hours, visual polish)
5. any type cleanup                   ← POST-BETA (3-4 hours, type safety)
```
