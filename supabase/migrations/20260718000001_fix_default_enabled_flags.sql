-- ================================================================
-- FIX: default_enabled mismatch per tier-spec.md §2.1
-- Generated on: July 18, 2026
-- Description:
--   tier-spec.md §2.1 specifies 15 keys should have default_enabled=true,
--   but the live DB has all 18 keys as false. This means new shops
--   without shop_features overrides get zero capabilities.
--
--   This migration sets default_enabled=true for the 14 keys that
--   tier-spec.md §2.1 says should default to enabled. The 15th key
--   (advanced_reports) is correctly false per tier-spec.
--
--   Impact: New shops automatically get features enabled per their
--   subscription tier. Platform Admin can still disable via shop_features.
-- ================================================================

-- ================================================================
-- 1. SET default_enabled = true for 14 keys
-- ================================================================

UPDATE feature_definitions
SET default_enabled = true
WHERE key IN (
  -- Free tier (8 keys)
  'inventory',
  'discounts',
  'draft_sales',
  'customer_management',
  'batch_tracking',
  'weight_based_products',
  'credit_system',
  'multi_tab_sales',
  -- Growth tier (6 keys)
  'printer_integration',
  'staff_accounts',
  'cash_drawer',
  'purchase_log',
  'stock_overview',
  'low_stock_alerts'
);

-- ================================================================
-- 2. VERIFICATION QUERIES
-- ================================================================

-- These 14 keys should now be true:
-- SELECT key, default_enabled, subscription_tier
-- FROM feature_definitions
-- WHERE key IN (
--   'inventory', 'discounts', 'draft_sales', 'customer_management',
--   'batch_tracking', 'weight_based_products', 'credit_system',
--   'multi_tab_sales', 'printer_integration', 'staff_accounts',
--   'cash_drawer', 'purchase_log', 'stock_overview', 'low_stock_alerts'
-- )
-- ORDER BY key;

-- These 4 keys should remain false:
-- SELECT key, default_enabled, subscription_tier
-- FROM feature_definitions
-- WHERE key IN ('pos', 'advanced_reports', 'owner_insights', 'simple_profit_report')
-- ORDER BY key;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
