-- ================================================================
-- Migration: Create purchase_logs Table
-- Date: July 15, 2026
-- Description:
--   Creates the purchase_logs table for recording supplier
--   purchases and stock intake (Growth+ tier, VISION.md v3.1.0
--   §10.2: Simplified Inventory Model). Part of the simplified
--   inventory that replaces the old Recipe BOM / COGS approach.
-- ================================================================

-- ================================================================
-- 1. TABLE: purchase_logs — Supplier Purchase Recording
-- ================================================================

CREATE TABLE IF NOT EXISTS purchase_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier      TEXT NOT NULL DEFAULT '',
  item          TEXT NOT NULL,
  quantity      NUMERIC NOT NULL CHECK (quantity > 0),
  unit          TEXT NOT NULL DEFAULT 'piece',
  unit_cost     NUMERIC NOT NULL CHECK (unit_cost >= 0),
  total_cost    NUMERIC NOT NULL GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT DEFAULT '',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- 2. INDEXES
-- ================================================================

DROP POLICY IF EXISTS "Purchase logs viewable by shop members" ON purchase_logs;
DROP POLICY IF EXISTS "Purchase logs insertable by shop members" ON purchase_logs;
DROP POLICY IF EXISTS "Purchase logs updatable by shop members" ON purchase_logs;
DROP POLICY IF EXISTS "Purchase logs deletable by shop admin/manager" ON purchase_logs;

CREATE INDEX IF NOT EXISTS idx_purchase_logs_shop_id     ON purchase_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_date        ON purchase_logs(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_supplier    ON purchase_logs(supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_item        ON purchase_logs(item);

-- Composite: purchases for a shop in a date range (the most common query)
CREATE INDEX IF NOT EXISTS idx_purchase_logs_shop_date   ON purchase_logs(shop_id, purchase_date DESC);

-- ================================================================
-- 3. RLS POLICIES
-- ================================================================

ALTER TABLE purchase_logs ENABLE ROW LEVEL SECURITY;

-- All shop members can view purchase logs for their shop
CREATE POLICY "Purchase logs viewable by shop members"
  ON purchase_logs FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- All shop members can create purchase logs for their shop
CREATE POLICY "Purchase logs insertable by shop members"
  ON purchase_logs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- All shop members can update purchase logs for their shop
CREATE POLICY "Purchase logs updatable by shop members"
  ON purchase_logs FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- Admin/manager can delete purchase logs
CREATE POLICY "Purchase logs deletable by shop admin/manager"
  ON purchase_logs FOR DELETE
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
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'purchase_logs'
--   ORDER BY ordinal_position;
--
-- RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'purchase_logs';
-- ================================================================
