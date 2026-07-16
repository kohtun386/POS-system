-- ================================================================
-- Migration: Create stock_items & stock_adjustments Tables
-- Date: July 15, 2026
-- Description:
--   Creates supply-level stock tracking tables (Growth+ tier,
--   VISION.md v3.1.0 §10.2: Simplified Inventory Model).
--   stock_items tracks current supply levels (e.g. coffee beans,
--   milk). stock_adjustments logs manual weekly count corrections.
--   This is separate from product.stock which tracks sellable
--   units of finished products.
-- ================================================================

-- ================================================================
-- 1. TABLE: stock_items — Supply-Level Stock Tracking
-- ================================================================

CREATE TABLE IF NOT EXISTS stock_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  quantity         NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit            TEXT NOT NULL DEFAULT 'piece',
  low_threshold   NUMERIC NOT NULL DEFAULT 0 CHECK (low_threshold >= 0),
  category        TEXT DEFAULT '',
  notes           TEXT DEFAULT '',
  last_adjusted_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate stock items per shop with same name
  UNIQUE (shop_id, name)
);

-- ================================================================
-- 2. TABLE: stock_adjustments — Manual Adjustment Log
-- ================================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  stock_item_id   UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  previous_qty    NUMERIC NOT NULL,
  new_qty         NUMERIC NOT NULL,
  reason          TEXT NOT NULL DEFAULT '',
  adjusted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  adjusted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- 3. INDEXES
-- ================================================================

DROP POLICY IF EXISTS "Stock items viewable by shop members" ON stock_items;
DROP POLICY IF EXISTS "Stock items insertable by shop members" ON stock_items;
DROP POLICY IF EXISTS "Stock items updatable by shop members" ON stock_items;
DROP POLICY IF EXISTS "Stock items deletable by shop admin/manager" ON stock_items;
DROP POLICY IF EXISTS "Stock adjustments viewable by shop members" ON stock_adjustments;
DROP POLICY IF EXISTS "Stock adjustments insertable by shop members" ON stock_adjustments;

CREATE INDEX IF NOT EXISTS idx_stock_items_shop_id       ON stock_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_name          ON stock_items(name);
CREATE INDEX IF NOT EXISTS idx_stock_items_low_threshold ON stock_items(low_threshold);

-- Composite: stock items for a shop (the most common query)
CREATE INDEX IF NOT EXISTS idx_stock_items_shop_name     ON stock_items(shop_id, name);

CREATE INDEX IF NOT EXISTS idx_stock_adj_shop_id         ON stock_adjustments(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_stock_item_id   ON stock_adjustments(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_adjusted_at     ON stock_adjustments(adjusted_at DESC);

-- Composite: adjustments for a specific stock item (history view)
CREATE INDEX IF NOT EXISTS idx_stock_adj_item_date       ON stock_adjustments(stock_item_id, adjusted_at DESC);

-- ================================================================
-- 4. RLS POLICIES — stock_items
-- ================================================================

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock items viewable by shop members"
  ON stock_items FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Stock items insertable by shop members"
  ON stock_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Stock items updatable by shop members"
  ON stock_items FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Stock items deletable by shop admin/manager"
  ON stock_items FOR DELETE
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
-- 5. RLS POLICIES — stock_adjustments
-- ================================================================

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock adjustments viewable by shop members"
  ON stock_adjustments FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Stock adjustments insertable by shop members"
  ON stock_adjustments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- ================================================================
-- VERIFICATION (run manually):
--
-- Table structure:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('stock_items', 'stock_adjustments')
--   ORDER BY table_name, ordinal_position;
--
-- RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('stock_items', 'stock_adjustments');
-- ================================================================
