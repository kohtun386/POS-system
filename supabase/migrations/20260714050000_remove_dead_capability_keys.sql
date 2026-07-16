-- ================================================================
-- Migration: Remove Dead Capability Keys
-- Date: July 14, 2026
-- Description:
--   Removes 4 capability keys that are explicitly out of scope
--   per VISION.md §19 "What We Are NOT Building".
--
--   Removed keys:
--   - multi_currency  (MMK-only policy, §19 — use constant instead)
--   - kitchen_display (thermal printer only, §19 — no KDS in v1)
--   - online_ordering (out of scope, §19 — v2 only)
--   - supplier_management (out of scope, §19 — v2 only)
--
--   Remaining keys after this migration: 11
--   Expected total after all phase-3 migrations: 18 (VISION.md §5.5)
-- ================================================================

-- ================================================================
-- 1. DELETE SHOP OVERRIDES FIRST (FK dependency: shop_features.feature_key
--    REFERENCES feature_definitions.key ON DELETE CASCADE)
-- ================================================================

DELETE FROM shop_features
WHERE feature_key IN (
  'multi_currency',
  'kitchen_display',
  'online_ordering',
  'supplier_management'
);

-- ================================================================
-- 2. DELETE DEAD FEATURE DEFINITIONS
--    ON DELETE CASCADE removes any remaining shop_features rows.
-- ================================================================

DELETE FROM feature_definitions
WHERE key IN (
  'multi_currency',
  'kitchen_display',
  'online_ordering',
  'supplier_management'
);

-- ================================================================
-- VERIFICATION (run manually):
--
-- Dead keys should return 0 rows:
--   SELECT key FROM feature_definitions
--   WHERE key IN ('multi_currency', 'kitchen_display', 'online_ordering', 'supplier_management');
--
-- Remaining count should be 11 (15 - 4):
--   SELECT COUNT(*) AS remaining_keys FROM feature_definitions;
-- ================================================================
