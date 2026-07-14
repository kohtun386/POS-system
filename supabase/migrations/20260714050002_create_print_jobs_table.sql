-- ================================================================
-- Migration: Create print_jobs Table
-- Date: July 14, 2026
-- Description:
--   Creates the print_jobs table for thermal printer integration
--   (Growth+ tier, VISION.md §5.5: printer_integration). Referenced
--   by printJobsService in src/lib/services.ts (lines 1534-1605)
--   and typed in src/lib/database.types.ts.
--
--   The table was expected by the service layer but never migrated;
--   this fills the gap.
-- ================================================================

-- ================================================================
-- 1. TABLE: print_jobs — Thermal Printer Job Queue
-- ================================================================

CREATE TABLE IF NOT EXISTS print_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES sales(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'printing', 'completed', 'failed')),
  config_data   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- ================================================================
-- 2. INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id    ON print_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status     ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order_id   ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);

-- Composite: pending jobs for a shop (the most common query)
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_status ON print_jobs(shop_id, status);

-- ================================================================
-- 3. RLS POLICIES
-- ================================================================

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- All shop members can view print jobs for their shop
CREATE POLICY "Print jobs viewable by shop members"
  ON print_jobs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- All shop members can create print jobs for their shop
CREATE POLICY "Print jobs insertable by shop members"
  ON print_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- Admin/manager can update print job status (mark printing/completed/failed)
CREATE POLICY "Print jobs updatable by shop admin/manager"
  ON print_jobs FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Admin/manager can delete print jobs
CREATE POLICY "Print jobs deletable by shop admin/manager"
  ON print_jobs FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- VERIFICATION (run manually):
--
-- Table structure:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'print_jobs'
--   ORDER BY ordinal_position;
--
-- RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'print_jobs';
-- ================================================================
