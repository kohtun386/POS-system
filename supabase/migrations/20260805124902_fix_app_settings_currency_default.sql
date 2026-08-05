-- ================================================================
-- Migration: Fix app_settings currency default to MMK
-- Date: 2026-08-05
-- Description:
--   Aligns app_settings.currency default with VISION.md §19 (MMK only).
--   shops.currency and shops.base_currency already default to MMK.
--   No backfill — only changes DEFAULT for future rows.
-- ================================================================

ALTER TABLE public.app_settings
    ALTER COLUMN currency SET DEFAULT 'MMK';