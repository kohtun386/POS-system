-- ================================================================
-- PRODUCTION CLEANUP: Deactivate Expired Sample Discounts
-- Generated on: June 19, 2026
-- Description:
--   The 3 seed discounts from 20250804000001_init.sql have
--   valid_to = '2025-12-31' which is in the past. Deactivate
--   them to prevent frontend from showing expired discounts.
--   Preserves discount records (don't delete — may have FK refs).
-- ================================================================

UPDATE discounts
SET active = false
WHERE valid_to < NOW()
  AND active = true;

-- Verification: should return 0
-- SELECT COUNT(*) FROM discounts WHERE valid_to < NOW() AND active = true;
