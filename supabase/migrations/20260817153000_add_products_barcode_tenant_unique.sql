-- ================================================================
-- Migration: Add products.barcode per-tenant uniqueness (P0)
-- ================================================================
-- Adds composite UNIQUE index on (shop_id, barcode) to prevent
-- duplicate barcodes within a single shop.
--
-- Follows the pattern of 20260817120000_fix_products_sku_tenant_isolation.sql
-- Uses a UNIQUE INDEX (not CONSTRAINT) because barcode is nullable
-- and multiple NULLs must remain allowed. WHERE clause excludes
-- both NULL and empty string ('') — the codebase convention is
-- that empty barcode submits become NULL in the DB
-- (ProductModal: formData.barcode || undefined → service: ?? null).
--
-- Idempotent: Safe to run multiple times (tracked by supabase_migrations).
-- No data loss: Drops index only if it exists, recreates with same name.
-- ================================================================

-- Step 1: Drop the old non-unique partial index (if exists)
DROP INDEX IF EXISTS idx_products_barcode;

-- Step 2: Create composite UNIQUE index on (shop_id, barcode)
-- Only applies to non-null, non-empty barcodes — allows unlimited
-- NULLs and empty strings (most products won't have a barcode).
-- Wrapped in DO block for idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_products_shop_id_barcode_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_products_shop_id_barcode_unique
      ON products (shop_id, barcode)
      WHERE barcode IS NOT NULL AND barcode <> '';
  END IF;
END $$;

-- ================================================================
-- Post-Apply Verification (SQL comments for manual verification only)
-- ================================================================
-- Run these queries manually after applying migration to verify:
--
-- 1. Check the new index exists:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'products' AND indexname LIKE '%barcode%';
--
-- 2. Check no duplicate (shop_id, barcode) pairs among non-null barcodes:
--    SELECT shop_id, barcode, COUNT(*)
--    FROM products
--    WHERE barcode IS NOT NULL AND barcode <> ''
--    GROUP BY shop_id, barcode
--    HAVING COUNT(*) > 1;
--    -- Expected: 0 rows (currently 0/68 products have a barcode)
--
-- 3. Check old index is gone:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'products' AND indexname = 'idx_products_barcode';
--    -- Expected: 0 rows
