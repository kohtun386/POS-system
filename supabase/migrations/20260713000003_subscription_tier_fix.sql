-- ================================================================
-- Migration: Fix Subscription Tier CHECK Constraint
-- Date: July 13, 2026
-- Description:
--   The shops.subscription_tier CHECK constraint allows
--   'enterprise' but the frontend only uses 'free', 'growth', 'pro'.
--   This migration:
--     1. Updates the CHECK constraint to match the tier hierarchy
--        from tier-spec.md: free (0) → growth (1) → pro (2)
--     2. Removes 'enterprise' from valid values
--     3. Updates any rows using 'enterprise' → 'pro'
--     4. Updates seed data that references 'enterprise' if any
-- ================================================================

-- ================================================================
-- 1. UPDATE EXISTING ROWS
--    Convert any 'enterprise' rows to 'pro' before changing constraint
-- ================================================================

UPDATE shops
SET subscription_tier = 'pro'
WHERE subscription_tier = 'enterprise';

-- ================================================================
-- 2. REPLACE CHECK CONSTRAINT
--    Drop old, add new with correct values
-- ================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing constraint name dynamically
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'shops'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%subscription_tier%';

  -- Drop the old constraint
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE shops DROP CONSTRAINT %I', constraint_name);
  END IF;

  -- Add the corrected constraint
  ALTER TABLE shops
    ADD CONSTRAINT shops_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'growth', 'pro'));
END $$;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify the constraint is correct:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'shops'::regclass AND contype = 'c';
-- Expected: shops_subscription_tier_check with ('free','growth','pro')

-- Verify no 'enterprise' rows remain:
-- SELECT subscription_tier, COUNT(*) FROM shops GROUP BY subscription_tier;
-- Expected: no 'enterprise' rows

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
