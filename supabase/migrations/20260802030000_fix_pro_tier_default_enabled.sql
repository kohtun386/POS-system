-- Fix regression: advanced_reports, owner_insights, and
-- simple_profit_report were seeded with default_enabled=true
-- in 20260714050001_seed_missing_capability_keys.sql, but were
-- later found reverted to false with no explicit migration
-- responsible. Migration 20260718000001's comment incorrectly
-- claimed "advanced_reports is correctly false per tier-spec" —
-- this was never true. tier-spec.md gates these via subscription
-- tier (min_tier=pro) alone; default_enabled=false made them
-- additionally opt-in via shop_features, which was never the
-- documented design. Confirmed with product owner 2026-08-02:
-- Pro tier should auto-unlock these features on upgrade, same
-- as all 6 Growth-tier features already behave.
--
-- Impact before this fix: 2 real paying Pro-tier shops
-- (Cele's Coffee Shop, Pro Test Shop) could not see Owner
-- Insights / Simple Profit Report despite paying for Pro tier.

UPDATE feature_definitions
SET default_enabled = true
WHERE key IN ('advanced_reports', 'owner_insights', 'simple_profit_report');
