-- ================================================================
-- Migration: Drop shop_features Table
-- Date: August 3, 2026
-- Description:
--   Drops the shop_features table and its RLS policies.
--   The per-shop override mechanism has been fully deprecated.
--   Frontend code no longer references shop_features.
--   resolve_capabilities() is now tier-only (20260803000000).
-- ================================================================

-- 1. Drop RLS policies
DROP POLICY IF EXISTS "Shop features viewable by shop members" ON public.shop_features;
DROP POLICY IF EXISTS "Shop features writable by shop admin" ON public.shop_features;

-- 2. Drop table (CASCADE removes indexes, constraints, FK references)
DROP TABLE IF EXISTS public.shop_features CASCADE;

-- ================================================================
-- VERIFICATION (run manually):
--
-- Confirm table is gone:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name = 'shop_features';
--   -- Should return 0 rows
--
-- Confirm function still works:
--   SELECT * FROM resolve_capabilities('<shop-uuid>');
-- ================================================================
