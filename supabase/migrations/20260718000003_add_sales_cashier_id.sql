-- ================================================================
-- ADD: cashier_id column to sales table
-- Generated on: July 18, 2026
-- Description:
--   Code in services.ts reads sale.cashier_id extensively for shift
--   management (VISION.md §12). The column doesn't exist in the DB.
--
--   This migration:
--   1. Adds cashier_id column (FK to users.id)
--   2. Backfills from existing cashier text column where possible
--   3. Adds index for shift tracking queries
-- ================================================================

-- ================================================================
-- 1. ADD COLUMN
-- ================================================================

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS cashier_id uuid REFERENCES public.users(id);

-- ================================================================
-- 2. BACKFILL: Match existing cashier text to user IDs
-- ================================================================

-- Update sales where cashier text matches a user's username
UPDATE public.sales s
SET cashier_id = u.id
FROM public.users u
WHERE s.cashier_id IS NULL
  AND s.cashier IS NOT NULL
  AND (u.username = s.cashier OR u.name = s.cashier);

-- ================================================================
-- 3. ADD INDEX for shift tracking queries
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_sales_cashier_id
ON public.sales (cashier_id)
WHERE cashier_id IS NOT NULL;

-- ================================================================
-- 4. VERIFICATION QUERIES
-- ================================================================

-- Verify column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'sales' AND column_name = 'cashier_id';

-- Verify backfill worked:
-- SELECT COUNT(*) as total_sales,
--        COUNT(cashier_id) as with_cashier_id,
--        COUNT(*) - COUNT(cashier_id) as without_cashier_id
-- FROM sales;

-- Sample matched sales:
-- SELECT s.id, s.invoice_number, s.cashier, s.cashier_id, u.username
-- FROM sales s
-- LEFT JOIN users u ON s.cashier_id = u.id
-- WHERE s.cashier_id IS NOT NULL
-- LIMIT 5;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
