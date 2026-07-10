# Tier Spec — Technical Contract

**Source of truth for tier definitions, feature gating, and capability mapping.**
**Any discrepancy between this document and code/DB → this document wins.**
**When VISION.md excludes a feature from business scope, VISION.md wins. For full precedence rules, see `docs/GOVERNANCE.md`.**

---

## 1. Tier Philosophy

| DB Key | Persona | Price (MMK/mo) | Target Customer |
|--------|---------|----------------|-----------------|
| `free` | **Starter** | 0 | Small shops, trial users, single-owner |
| `growth` | **Scaler** | 49,000 | Mid-size shops, multi-staff, recipe-driven |
| `pro` | **Strategist** | 149,000 | High-volume shops, owner needs P&L insights |

**Pricing logic:** Each tier roughly doubles. Starter is zero-friction entry. Scaler unlocks operational tools (recipes, printers, shifts). Strategist unlocks analytics (P&L, waste, margins).

---

## 2. Capability Mapping (All 19 Active Features)

### 2.1 Canonical Feature Table

| # | Feature Key | Min Tier | DB `default_enabled` | Description |
|---|-------------|----------|---------------------|-------------|
| 1 | `pos` | free | — | POS terminal (always available, not in feature_definitions) |
| 2 | `inventory` | free | true | Stock tracking |
| 3 | `discounts` | free | true | Discount engine |
| 4 | `draft_sales` | free | true | Draft/pending sales |
| 6 | `customer_management` | free | true | Customer records |
| 7 | `batch_tracking` | free | true | Batch/lot tracking (embedded in ProductModal) |
| 8 | `weight_based_products` | free | true | Per-unit pricing (embedded in ProductModal) |
| 9 | `credit_system` | free | true | Customer credit tracking |
| 10 | `multi_tab_sales` | free | true | Multi-tab POS workflow |
| 11 | `printer_integration` | **growth** | true | Thermal printer support |
| 12 | `staff_accounts` | **growth** | true | Multiple staff logins |
| 13 | `cash_drawer` | **growth** | true | Shift start/end management |
| 14 | `purchase_log` | **growth** | true | Purchase recording (supplier, item, qty, cost) |
| 15 | `stock_overview` | **growth** | true | Stock levels & manual adjustments |
| 16 | `low_stock_alerts` | **growth** | true | Threshold-based stock alerts |
| 17 | `advanced_reports` | **pro** | false | Consolidated Pro reports gate |
| 18 | `owner_insights` | **pro** | false | P&L dashboard |
| 19 | `profit_analytics` | **pro** | false | Profit margin analytics |
| 20 | `simple_profit_report` | **pro** | false | Revenue − Purchases profit calculation |

### 2.2 Dead Keys (DB rows only — no UI or code reference)

| Feature Key | DB Tier | Status | Reason |
|-------------|---------|--------|--------|
| `kitchen_display` | pro | **DEAD** | Out of scope for Myanmar market. No KDS screens used — kitchen routing handled via `printer_integration` (Growth tier). Component code deleted 2026-07-04. |
| `online_ordering` | pro | **DEAD** | VISION §19: "NOT Building" in v1 |
| `supplier_management` | pro | **DEAD** | No component exists |
| `recipe_bom` | growth | **DEAD** | Removed per VISION §10.3 scope reframe. BOM/COGS not needed for Myanmar coffee shop market. DB table `recipes` deprecated. |
| `raw_materials` | growth | **DEAD** | Removed per VISION §10.3 scope reframe. Raw material tracking replaced by Purchase Log (Growth). DB table `raw_materials` deprecated. |
| `waste_tracking` | pro | **DEAD** | Removed per VISION §10.3/§19 scope reframe. Waste tracking requires recipe-level tracking which is out of scope. Use low stock alerts (Growth) instead. |
| `multi_currency` | free | **DEAD** | Myanmar market is MMK-only. Tables `currency_config`, `exchange_rates`, `exchange_rate_history` deprecated. |

These keys stay in the DB for forward compatibility but are never checked in code. Do not gate new features on them.

### 2.3 Implicit Features (no feature_definitions row)

| Feature Key | Tier | Notes |
|-------------|------|-------|
| `pos` | free | Always available; VISION §5.5 lists it but no DB row needed |

---

## 3. Resolution Rules

### 3.1 Tier Hierarchy

```typescript
const TIER_HIERARCHY = { free: 0, growth: 1, pro: 2 }
```

A shop at tier N gets all features where `minTier ≤ N`.

### 3.2 Resolution Flow

1. Read `shops.subscription_tier` → map to level (0/1/2)
2. Read `feature_definitions` → for each row, check `subscription_tier` level ≤ shop level
3. Apply `shop_features` overrides (per-shop enable/disable)
4. Filter by `default_enabled` if no override exists
5. Return flat `string[]` of capability keys

### 3.3 Override Precedence

```
shop_features override > feature_definitions.default_enabled
```

If a shop has `{ feature_key: 'printer_integration', enabled: true }` in `shop_features`, the feature is available regardless of tier.

### 3.4 Quantitative Tier Limits

Beyond binary feature gating, Free tier has quantitative limits enforced server-side:

| Limit | Free Tier | Growth+ | Enforcement |
|-------|-----------|---------|-------------|
| Daily orders | 50/day | Unlimited | Server-side in checkout RPC (`checkout_complete`). Row-level locking prevents race conditions. Returns `DAILY_LIMIT_REACHED` error code. |
| Products | 50 max | Unlimited | Client-side validation at product creation + server-side guard in product insert. |

These limits are NOT capability keys — they're enforced in the business logic layer, not the feature-flag system.

---

## 4. v1.0 Scope Boundary

### IN SCOPE (must have for v1.0)

- All 19 active features listed in §2.1
- 3-tier gating (free → growth → pro)
- Per-shop feature overrides via `shop_features`
- `advanced_reports` as consolidated Pro reports gate

### OUT OF SCOPE (deferred to v2)

- Device detection (mobile vs desktop)
- Offline-first mode
- Session tracking / analytics
- Audit logs (basic void tracking is v1, full audit trail is v2)
- `kitchen_display`, `online_ordering`, `supplier_management` (dead keys)

---

## 5. AI Harness Rules

When modifying feature gating, capability keys, or tier assignments:

1. **Read Before Write** — Always read `TIER-SPEC.md` before changing any tier assignment
2. **Capability-Only Logic** — Gate features via `useCapability('key')`, never check `shop.subscriptionTier` directly
3. **Migration First** — DB tier changes require a migration; never update `feature_definitions` without a migration file
4. **New Features Require Tier Assignment** — Every new feature key must specify a `minTier` in this document before implementation
5. **Dead Keys Are Dead** — Do not reference `kitchen_display`, `online_ordering`, `supplier_management`, `recipe_bom`, `raw_materials`, `waste_tracking`, or `multi_currency` in new code
6. **Override Precedence** — Per-shop overrides always win; document the override in the migration if it's business-critical

---

## 6. Notification Channels

| Channel | Type | Tier | Purpose |
|---------|------|------|---------|
| WhatsApp Business API | Automated | Pro | Daily P&L report (Revenue, Purchases, Profit, shift count, variance alerts). Delivered at 9:00 PM Asia/Yangon. |
| Viber | Manual | All | Customer billing communication. Owner contacts Ko Htun via Viber for subscription activation/payment. Not automated. |
| Email/SMS | Automated | Growth+ | Alert system notifications (low stock, threshold alerts). Configured per shop in alert settings. |

**Note:** WhatsApp is the primary automated notification channel. Viber is manual (human-to-human). Email/SMS is for system-generated alerts only.

---

## 7. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-03 | VISION.md is single source of truth | Business scope drives technical implementation |
| 2026-07-03 | batch_tracking, weight_based_products, credit_system, multi_tab_sales stay Free | They're embedded in ProductModal/POS; no standalone component to gate |
| 2026-07-03 | kitchen_display, online_ordering, supplier_management are dead keys | No UI components; code uses printer_integration instead |
| 2026-07-03 | owner_insights, profit_analytics gated by advanced_reports | Code consolidates Pro reports under single gate |
| 2026-07-03 | printer_integration, staff_accounts, cash_drawer → growth (not free) | VISION §5.5 and §3.2 define these as Growth features |
| 2026-07-03 | recipe_bom, raw_materials → growth (not pro) | VISION §5.5 defines these as Growth features; Growth selling point |
| 2026-07-10 | Cross-document SSOT audit completed | 15 governance decisions resolved. VISION.md confirmed as product-scope authority. |
| 2026-07-10 | `recipe_bom`, `raw_materials`, `waste_tracking`, `multi_currency` → Dead Keys | VISION §10.3/§19 excludes from v1 scope. DB tables deprecated. |
| 2026-07-10 | `purchase_log`, `stock_overview`, `low_stock_alerts`, `simple_profit_report` added | Present in VISION §5.5 and codebase but missing from tier-spec §2.1. |
| 2026-07-10 | Quantitative tier limits section added | Daily order limit (50/day) and product limit (50) documented as server-side enforcement rules. |
| 2026-07-10 | Document precedence chain formalized | VISION.md (scope) > tier-spec.md (implementation) > CLAUDE.md (agent rules) > README.md (summary). |
| 2026-07-10 | Notification channels documented | WhatsApp (automated, Pro), Viber (manual, billing), Email/SMS (alerts). |

---

*This document is the canonical source for tier assignments. Update it before changing code or DB.*
