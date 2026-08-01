-- ================================================================
-- Capability-gate purchase_logs, stock_items, stock_adjustments
-- ================================================================
-- Adds has_capability() check to every RLS policy on these 3 tables.
-- Also tightens INSERT policies to require admin/manager role
-- (Phase 1a found they allowed any shop member).
--
-- stock_adjustments: no UPDATE/DELETE policies — append-only
-- audit log pattern, confirmed intentional.
-- ================================================================

-- ================================================================
-- 1. purchase_logs (capability: 'purchase_log')
-- ================================================================

-- SELECT
DROP POLICY IF EXISTS "Purchase logs viewable by shop members" ON public.purchase_logs;
CREATE POLICY "Purchase logs viewable by shop members" ON public.purchase_logs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'purchase_log')
  );

-- INSERT (add role gate — was open to any member)
DROP POLICY IF EXISTS "Purchase logs insertable by shop members" ON public.purchase_logs;
CREATE POLICY "Purchase logs insertable by shop membership role" ON public.purchase_logs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'purchase_log')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = purchase_logs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- UPDATE (preserve existing admin/manager gate, add capability)
DROP POLICY IF EXISTS "Purchase logs updatable by shop membership role" ON public.purchase_logs;
CREATE POLICY "Purchase logs updatable by shop membership role" ON public.purchase_logs
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'purchase_log')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = purchase_logs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- DELETE (preserve existing admin/manager gate, add capability)
DROP POLICY IF EXISTS "Purchase logs deletable by shop membership role" ON public.purchase_logs;
CREATE POLICY "Purchase logs deletable by shop membership role" ON public.purchase_logs
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'purchase_log')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = purchase_logs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 2. stock_items (capability: 'stock_overview')
-- ================================================================

-- SELECT
DROP POLICY IF EXISTS "Stock items viewable by shop members" ON public.stock_items;
CREATE POLICY "Stock items viewable by shop members" ON public.stock_items
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
  );

-- INSERT (add role gate — was open to any member)
DROP POLICY IF EXISTS "Stock items insertable by shop members" ON public.stock_items;
CREATE POLICY "Stock items insertable by shop membership role" ON public.stock_items
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_items.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- UPDATE (preserve existing admin/manager gate, add capability)
DROP POLICY IF EXISTS "Stock items updatable by shop membership role" ON public.stock_items;
CREATE POLICY "Stock items updatable by shop membership role" ON public.stock_items
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_items.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- DELETE (preserve existing admin/manager gate, add capability)
DROP POLICY IF EXISTS "Stock items deletable by shop membership role" ON public.stock_items;
CREATE POLICY "Stock items deletable by shop membership role" ON public.stock_items
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_items.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 3. stock_adjustments (capability: 'stock_overview')
--    Only INSERT + SELECT exist. No UPDATE/DELETE (append-only).
-- ================================================================

-- SELECT
DROP POLICY IF EXISTS "Stock adjustments viewable by shop members" ON public.stock_adjustments;
CREATE POLICY "Stock adjustments viewable by shop members" ON public.stock_adjustments
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
  );

-- INSERT (preserve existing admin/manager gate from Migration 1, add capability)
DROP POLICY IF EXISTS "Stock adjustments insertable by shop membership role" ON public.stock_adjustments;
CREATE POLICY "Stock adjustments insertable by shop membership role" ON public.stock_adjustments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = stock_adjustments.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );
