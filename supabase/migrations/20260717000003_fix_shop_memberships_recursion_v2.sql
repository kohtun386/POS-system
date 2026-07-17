-- ================================================================
-- FIX: shop_memberships policy infinite recursion (second occurrence)
-- Generated on: July 17, 2026
-- Description:
--   Migration 20260717000002 reintroduced the infinite recursion
--   bug originally fixed in 20260620000003. The new policy on
--   shop_memberships calls current_shop_ids(), which queries
--   shop_memberships → infinite recursion (42P17).
--
--   Error: "infinite recursion detected in policy for relation
--   shop_memberships"
--
--   Fix: Replace current_shop_ids() with a direct aliased subquery.
--   The aliased subquery (sm.shop_id) doesn't trigger the same
--   RLS re-evaluation as the function call.
-- ================================================================

-- ================================================================
-- 1. DROP RECURSIVE POLICY
-- ================================================================

DROP POLICY IF EXISTS "Shop memberships write by shop membership admin" ON public.shop_memberships;

-- ================================================================
-- 2. RECREATE WITH DIRECT CHECK (no current_shop_ids() call)
-- ================================================================
-- Pattern: direct subquery with aliased table reference
-- This avoids the recursion because the aliased subquery is
-- evaluated inline without re-entering the RLS policy engine.

CREATE POLICY "Shop memberships write by shop membership admin" ON public.shop_memberships
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN (
      SELECT sm.shop_id FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid() AND sm.is_active = true
    ))
    AND (EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
      AND sm.role = 'admin'::text
      AND sm.is_active = true
    ))
  );

-- ================================================================
-- VERIFICATION
-- ================================================================
-- Test: should return own memberships without recursion error
-- SELECT * FROM shop_memberships WHERE user_id = auth.uid();

-- Test: other tables should also work now
-- SELECT * FROM products LIMIT 1;
-- SELECT * FROM customers LIMIT 1;
