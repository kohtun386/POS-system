-- ================================================================
-- ADD: Missing columns to shops table
-- Generated on: July 18, 2026
-- Description:
--   Code in services.ts mapShopRow() reads 7 columns that don't exist
--   in the DB: logo, business_type, tax_rate, invoice_prefix,
--   invoice_counter, draft_retention_days, receipt_setting.
--
--   These columns are documented in database.md §6.1 but were never
--   added to the actual DB. This migration adds them with sensible
--   defaults matching the documented schema.
-- ================================================================

-- ================================================================
-- 1. ADD COLUMNS (idempotent — IF NOT EXISTS)
-- ================================================================

-- Store logo (base64 or URL)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS logo text;

-- Business type (locked to 'coffee_shop' in v1 per VISION.md §19)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'coffee_shop';

-- Per-shop tax rate (numeric(5,4))
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) NOT NULL DEFAULT 0.0000;

-- Per-shop display currency (locked to MMK per VISION.md §19)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MMK';

-- Per-shop base currency for pricing (locked to MMK per VISION.md §19)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'MMK';

-- Invoice number prefix
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'INV';

-- Current invoice counter (mutated only by atomic invoice DB function)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS invoice_counter integer NOT NULL DEFAULT 1000;

-- Cleanup retention for draft sales (days)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS draft_retention_days integer NOT NULL DEFAULT 30;

-- Receipt prompt setting (Growth+ only per VISION.md §9)
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS receipt_setting text NOT NULL DEFAULT 'ask';

-- ================================================================
-- 2. ADD CHECK CONSTRAINTS (idempotent)
-- ================================================================

-- Business type: only 'coffee_shop' in v1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_business_type_check'
  ) THEN
    ALTER TABLE public.shops
    ADD CONSTRAINT shops_business_type_check
    CHECK (business_type IN ('coffee_shop'));
  END IF;
END $$;

-- Receipt setting: 'always', 'ask', or 'never'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_receipt_setting_check'
  ) THEN
    ALTER TABLE public.shops
    ADD CONSTRAINT shops_receipt_setting_check
    CHECK (receipt_setting IN ('always', 'ask', 'never'));
  END IF;
END $$;

-- ================================================================
-- 3. BACKFILL EXISTING DATA
-- ================================================================

-- Set business_type for existing shops
UPDATE public.shops
SET business_type = 'coffee_shop'
WHERE business_type IS NULL;

-- Set currency for existing shops
UPDATE public.shops
SET currency = 'MMK', base_currency = 'MMK'
WHERE currency IS NULL OR base_currency IS NULL;

-- ================================================================
-- 4. VERIFICATION QUERIES
-- ================================================================

-- Verify all 7 columns exist:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'shops'
--   AND column_name IN ('logo', 'business_type', 'tax_rate', 'currency',
--     'base_currency', 'invoice_prefix', 'invoice_counter',
--     'draft_retention_days', 'receipt_setting')
-- ORDER BY ordinal_position;

-- Verify existing shop data:
-- SELECT id, name, business_type, currency, tax_rate, invoice_prefix
-- FROM shops LIMIT 5;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
