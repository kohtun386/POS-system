-- ================================================================
-- Migration: Align Capability Keys — Frontend ↔ DB Mapping
-- Date: July 13, 2026
-- Description:
--   Fixes capability key mismatches between frontend useCapability()
--   calls and feature_definitions table. Renames two keys and adds
--   two missing keys used by the frontend.
--
--   Changes:
--   - inventory_tracking → inventory
--   - discount_engine → discounts
--   - INSERT: printer_integration (missing in DB)
--   - INSERT: staff_accounts (missing in DB)
-- ================================================================

-- ================================================================
-- 1. RENAME MISMATCHED KEYS
-- ================================================================

-- Rename inventory_tracking → inventory
UPDATE feature_definitions
SET key = 'inventory'
WHERE key = 'inventory_tracking';

-- Rename discount_engine → discounts
UPDATE feature_definitions
SET key = 'discounts'
WHERE key = 'discount_engine';

-- ================================================================
-- 2. INSERT MISSING KEYS
-- ================================================================

-- printer_integration: Thermal printer receipt support
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'printer_integration', 'Receipt Printing', 'Thermal printer receipt support', 'pos', true, 'growth'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_definitions WHERE key = 'printer_integration'
);

-- staff_accounts: Multiple staff user accounts
INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
SELECT 'staff_accounts', 'Staff Accounts', 'Multiple staff user accounts', 'general', true, 'growth'
WHERE NOT EXISTS (
  SELECT 1 FROM feature_definitions WHERE key = 'staff_accounts'
);

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify renamed keys exist with new names
SELECT key, name, category, subscription_tier, default_enabled
FROM feature_definitions
WHERE key IN ('inventory', 'discounts', 'printer_integration', 'staff_accounts')
ORDER BY key;

-- Count should be 4 (2 renamed + 2 inserted)
-- SELECT COUNT(*) AS aligned_keys FROM feature_definitions WHERE key IN ('inventory', 'discounts', 'printer_integration', 'staff_accounts');

-- =============================================================-- MIGRATION COMPLETE
-- ================================================================