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

---

## Short-Term Roadmap

Features needed for beta in real coffee shop. Blocked until decisions made.

### 1. PWA Conversion — Offline & Installable

**Status:** Needs approach decision.

Partial PWA assets exist (`site.webmanifest`, icons, `<link rel="manifest">`, theme-color meta) but no service worker, no offline capability, no local state persistence.

**Open decision — which offline tier?**

| Option | Scope | Effort |
|---|---|---|
| **A — Soft-offline** | Cache UI shell + fonts + icons. Cart survives refresh. Auth session cached. Operations wait for network. | 1-2 days |
| **B — Hard-offline** | Full local-first. Process sales offline, queue sync. Conflict resolution. Needs Dexie/IndexedDB local store + sync protocol. | 1-2 weeks |
| **C — Hybrid** | B for sales-critical path (checkout queues offline), A for everything else (products/customers cached stale for browsing) | 3-5 days |

**Recommendation:** Start with **Option A** for beta. Delivers 80% of user value (app launches from home screen, survives WiFi hiccups). Upgrade to C post-beta based on real connectivity data from shop.

**Dependencies before implementation:**
- Fix `site.webmanifest`: `name` → `"CoffeeShop POS"`, `short_name` → `"CoffeePOS"`, `theme_color` → `"#473b32"`, `background_color` → `"#faf8f5"`
- Fix `<link rel="icon">` from `/vite.svg` (missing) → `/favicon-32x32.png`
- Decision on Option A vs B vs C

**Effort:** 1-2 days (Option A), after decision.

### 2. Localization (i18n) — English / Myanmar

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
- Food Costing feature (ingredients, recipes, COGS) — see PM brainstorm
- Sales tab sharing between baristas
- Alert system wiring into navigation

---

## Priority Order

```
1. PWA decision + Option A impl       ← NEXT (1-2 days, gating beta)
2. i18n scoping + impl                ← AFTER PWA (2-3 days, needed for Myanmar beta)
3. React Refresh warnings             ← POST-BETA (1 hour, dev experience)
4. Color palette formalization        ← POST-BETA (1-2 hours, visual polish)
5. any type cleanup                   ← POST-BETA (3-4 hours, type safety)
```
