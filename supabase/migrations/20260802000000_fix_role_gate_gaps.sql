-- ================================================================
-- Fix role-authorization gaps in RLS policies
-- ================================================================
-- Three tables have UPDATE/INSERT policies that allow any shop
-- member, bypassing the admin/manager role gate required by
-- VISION.md §4.4 Role Matrix.
--
-- Tables affected:
--   1. purchase_logs  — UPDATE: any member → admin/manager only
--   2. stock_items    — UPDATE: any member → admin/manager only
--   3. stock_adjustments — INSERT: any member → admin/manager only
--
-- stock_adjustments has NO UPDATE or DELETE policies (append-only
-- audit log pattern). Implicit deny is correct — do not add.
-- ================================================================

-- 1. purchase_logs: tighten UPDATE to admin/manager
DROP POLICY IF EXISTS "Purchase logs updatable by shop members" ON public.purchase_logs;

CREATE POLICY "Purchase logs updatable by shop membership role" ON public.purchase_logs
  FOR UPDATE
  USING (
    (auth.role() = 'authenticated')
    AND (shop_id IN (SELECT current_shop_ids()))
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = purchase_logs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- 2. stock_items: tighten UPDATE to admin/manager
DROP POLICY IF EXISTS "Stock items updatable by shop members" ON public.stock_items;

CREATE POLICY "Stock items updatable by shop membership role" ON public.stock_items
  FOR UPDATE
  USING (
    (auth.role() = 'authenticated')
    AND (shop_id IN (SELECT current_shop_ids()))
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_items.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- 3. stock_adjustments: tighten INSERT to admin/manager
DROP POLICY IF EXISTS "Stock adjustments insertable by shop members" ON public.stock_adjustments;

CREATE POLICY "Stock adjustments insertable by shop membership role" ON public.stock_adjustments
  FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated')
    AND (shop_id IN (SELECT current_shop_ids()))
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_adjustments.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );
