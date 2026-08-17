-- ================================================================
-- Migration: Fix products.sku tenant isolation (P0)
-- ================================================================
-- Replaces global UNIQUE(sku) with composite UNIQUE(shop_id, sku)
-- to comply with VISION.md §18.2 tenant isolation.
--
-- Follows the exact pattern of 20260812091756_fix_categories_tenant_isolation.sql
-- (global UNIQUE dropped, per-tenant composite added, same idempotent guard)
--
-- Idempotent: Safe to run multiple times (tracked by supabase_migrations).
-- No data loss: Drops constraint only if it exists, recreates composite.
-- ================================================================

-- Step 1: Drop the global UNIQUE constraint on sku (if exists)
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_sku_key;

-- Step 2: Drop the old non-unique supporting index (if exists)
DROP INDEX IF EXISTS idx_products_sku;

-- Step 3: Create composite UNIQUE constraint on (shop_id, sku)
-- Wrapped in DO block for idempotency — skips if constraint already exists.
-- This allows different shops to have products with the same SKU
-- while preventing duplicates within a single shop.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass
    AND conname = 'products_shop_id_sku_unique'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_shop_id_sku_unique
      UNIQUE (shop_id, sku);
  END IF;
END $$;

-- Step 4: Create replacement per-shop index
CREATE INDEX IF NOT EXISTS idx_products_shop_id_sku
  ON products (shop_id, sku);

-- ================================================================
-- Post-Apply Verification (SQL comments for manual verification only)
-- ================================================================
-- Run these queries manually after applying migration to verify:
--
-- 1. Check constraints (should show composite UNIQUE, not global):
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'products'::regclass AND contype = 'u';
--
-- 2. Check no duplicate (shop_id, sku) pairs:
--    SELECT shop_id, sku, COUNT(*)
--    FROM products
--    GROUP BY shop_id, sku
--    HAVING COUNT(*) > 1;
--
-- 3. Sample data:
--    SELECT id, name, sku, shop_id FROM products LIMIT 5;
