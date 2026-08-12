-- ================================================================
-- Migration: Fix categories tenant isolation (P0)
-- ================================================================
-- Replaces global UNIQUE(name) with composite UNIQUE(shop_id, name)
-- to comply with VISION.md §18.2 tenant isolation.
--
-- Idempotent: Safe to run multiple times (tracked by supabase_migrations).
-- No data loss: Drops constraint only if it exists, recreates composite.
-- ================================================================

-- Step 1: Drop the global UNIQUE constraint on name (if exists)
ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_name_key;

-- Step 2: Create composite UNIQUE constraint on (shop_id, name)
-- Wrapped in DO block for idempotency — skips if constraint already exists.
-- This allows different shops to have categories with the same name
-- while preventing duplicates within a single shop.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'categories'::regclass
    AND conname = 'categories_shop_id_name_unique'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_shop_id_name_unique
      UNIQUE (shop_id, name);
  END IF;
END $$;

-- ================================================================
-- Post-Apply Verification (SQL comments for manual verification only)
-- ================================================================
-- Run these queries manually after applying migration to verify:
--
-- 1. Check constraints (should show composite UNIQUE, not global):
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'categories'::regclass AND contype = 'u';
--
-- 2. Check no duplicate (shop_id, name) pairs:
--    SELECT shop_id, name, COUNT(*)
--    FROM categories
--    GROUP BY shop_id, name
--    HAVING COUNT(*) > 1;
--
-- 3. Sample data:
--    SELECT id, name, shop_id, active FROM categories LIMIT 5;
