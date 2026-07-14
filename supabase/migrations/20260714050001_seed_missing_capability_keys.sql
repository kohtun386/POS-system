-- ================================================================
-- Migration: Seed Missing Capability Keys
-- Date: July 14, 2026
-- Description:
--   Inserts 7 missing capability keys from VISION.md §5.5
--   to bring feature_definitions from 11 → 18 keys.
--
--   New keys:
--   Free (1):  pos
--   Growth (4): purchase_log, stock_overview, low_stock_alerts, cash_drawer
--   Pro (2):    owner_insights, simple_profit_report
-- ================================================================

-- ================================================================
-- 1. FREE TIER
-- ================================================================

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'pos', 'POS Terminal', 'Point-of-sale terminal functionality', 'pos', true, 'free'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'pos');

-- ================================================================
-- 2. GROWTH TIER
-- ================================================================

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'purchase_log', 'Purchase Log', 'Record supplier purchases and stock intake', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'purchase_log');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'stock_overview', 'Stock Overview', 'View stock levels and make adjustments', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'stock_overview');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'low_stock_alerts', 'Low Stock Alerts', 'Threshold-based stock level alerts', 'inventory', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'low_stock_alerts');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'cash_drawer', 'Cash Drawer', 'Cash shift start and end management', 'pos', true, 'growth'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'cash_drawer');

-- ================================================================
-- 3. PRO TIER
-- ================================================================

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'owner_insights', 'Owner Insights', 'Profit & loss dashboard for shop owners', 'reports', true, 'pro'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'owner_insights');

INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'simple_profit_report', 'Simple Profit Report', 'Revenue minus purchases summary', 'reports', true, 'pro'
WHERE NOT EXISTS (SELECT 1 FROM feature_definitions WHERE key = 'simple_profit_report');

-- ================================================================
-- VERIFICATION (run manually):
--
-- Should return all 18 keys from VISION.md §5.5:
--   SELECT key, name, subscription_tier
--   FROM feature_definitions
--   ORDER BY
--     CASE subscription_tier WHEN 'free' THEN 0 WHEN 'growth' THEN 1 WHEN 'pro' THEN 2 END,
--     key;
--
-- Final count should be 18:
--   SELECT COUNT(*) AS total_keys FROM feature_definitions;
-- ================================================================
