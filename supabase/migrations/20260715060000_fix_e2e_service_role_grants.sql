-- Migration: Fix E2E service_role permissions for inventory tables
-- Date: 2026-07-15
-- Purpose: Allow service_role to perform CRUD operations for E2E test cleanup.
-- Architecture: service_role bypasses RLS (VISION.md §18.2), so only GRANTs are needed.
-- Idempotency: GRANT statements are naturally idempotent in PostgreSQL.

GRANT ALL ON public.purchase_logs TO service_role;
GRANT ALL ON public.stock_items TO service_role;
GRANT ALL ON public.stock_adjustments TO service_role;
