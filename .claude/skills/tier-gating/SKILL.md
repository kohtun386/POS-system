---
name: tier-gating
description: Use when changing tier assignments, feature gating, capability keys, or subscription-tier logic — references tier-spec.md and the 18 valid capability keys
---

## Tier & Feature Gating Protocol

**Source of truth:** `docs/specs/tier-spec.md` — read it before any tier/capability change.
**Document precedence:** See `docs/README.md` (Governance section) for conflict resolution rules. Quick reference: VISION.md (scope) > tier-spec.md (implementation) > CLAUDE.md (agent rules).

| Rule | Description |
|------|-------------|
| **Read Before Write** | Always read `tier-spec.md` before changing tier assignments or feature gating |
| **Capability-Only Logic** | Gate via `useCapability('key')`, never check `shop.subscriptionTier` directly |
| **Migration First** | DB tier changes require a migration file in `supabase/migrations/`; never update `feature_definitions` without one |
| **New Features Require Tier Assignment** | Every new feature key must have a `minTier` in `tier-spec.md` before implementation starts |

**Tier hierarchy:** `free (0) → growth (1) → pro (2)` — a shop at tier N gets all features where `minTier ≤ N`.

**CI validation:** Run `npx tsx scripts/validate-tiers.ts` to verify DB matches tier-spec.md. Fails build on mismatch.

## Valid Capability Keys (18 total — VISION.md v3.1.0 §5.5)

**DO NOT invent capability keys not in this list.** Components check these via `state.capabilities.includes('key')`.

| Capability | Min Tier |
|------------|----------|
| `pos` | free |
| `inventory` | free |
| `discounts` | free |
| `draft_sales` | free |
| `customer_management` | free |
| `batch_tracking` | free |
| `weight_based_products` | free |
| `credit_system` | free |
| `multi_tab_sales` | free |
| `printer_integration` | growth |
| `purchase_log` | growth |
| `stock_overview` | growth |
| `low_stock_alerts` | growth |
| `staff_accounts` | growth |
| `cash_drawer` | growth |
| `owner_insights` | pro |
| `simple_profit_report` | pro |
| `advanced_reports` | pro |
