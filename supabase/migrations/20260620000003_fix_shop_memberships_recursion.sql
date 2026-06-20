-- ================================================================
-- FIX: shop_memberships policy infinite recursion
-- Generated on: June 20, 2026
-- Description:
--   shop_memberships SELECT policy called current_shop_ids(),
--   which queries shop_memberships → infinite recursion (42P17).
--
--   Fix: shop_memberships policies use direct checks instead of
--   current_shop_ids(). SELECT uses user_id = auth.uid().
--   Write uses global admin check (users.role = 'admin').
--
--   Also: shops policy had same risk (queries shop_memberships
--   via current_shop_ids()). Fix: direct id check against
--   user_id in shop_memberships.
-- ================================================================

-- ================================================================
-- 1. DROP RECURSIVE POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Shop memberships viewable by shop members" ON shop_memberships;
DROP POLICY IF EXISTS "Shop memberships write by shop admin" ON shop_memberships;
DROP POLICY IF EXISTS "Shops viewable by members" ON shops;
DROP POLICY IF EXISTS "Shops write by shop admin" ON shops;

-- ================================================================
-- 2. FIX SHOP_MEMBERSHIPS POLICIES
--    SELECT: user can see own memberships (user_id = auth.uid())
--    ALL: global admin only (avoids recursion)
-- ================================================================

CREATE POLICY "Shop memberships viewable by own user" ON shop_memberships
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );

CREATE POLICY "Shop memberships write by global admin" ON shop_memberships
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ================================================================
-- 3. FIX SHOPS POLICIES
--    SELECT: user can see shops they're member of (direct join)
--    ALL: global admin only
-- ================================================================

CREATE POLICY "Shops viewable by own memberships" ON shops
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND id IN (
      SELECT shop_id FROM public.shop_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Shops write by global admin" ON shops
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Test: should return shops without recursion error
-- SELECT id, name FROM shops;

-- Test: should return own memberships without recursion error
-- SELECT * FROM shop_memberships WHERE user_id = auth.uid();
