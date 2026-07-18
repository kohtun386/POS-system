-- ================================================================
-- FIX: shop_memberships policy infinite recursion (third attempt)
-- Generated on: July 18, 2026
-- Description:
--   Migration 20260717000003 (v2) replaced current_shop_ids() with
--   aliased subqueries, assuming they bypass RLS re-evaluation.
--   This assumption is WRONG — PostgreSQL applies RLS to aliased
--   subqueries on the same relation, causing infinite recursion.
--
--   Error: "infinite recursion detected in policy for relation
--   shop_memberships" (42P17)
--
--   Confirmed by PostgreSQL logs: 3 occurrences on July 18, 2026.
--
--   Fix: Create a SECURITY DEFINER function (is_shop_admin) that
--   bypasses RLS entirely, then replace the recursive ALL policy
--   with separate INSERT/UPDATE/DELETE policies that call this
--   function instead of querying shop_memberships directly.
--
-- WHY SECURITY DEFINER IS SAFE HERE:
--   - is_shop_admin() queries shop_memberships, but SECURITY
--     DEFINER executes as the function owner, bypassing RLS
--   - The function is read-only (STABLE, no side effects)
--   - Same pattern used by current_shop_ids() (also SECURITY
--     DEFINER) which is called from 20+ policies on other tables
--   - All other tables already use current_shop_ids() safely;
--     only shop_memberships itself has the recursion problem
-- ================================================================

-- ================================================================
-- 1. CREATE SECURITY DEFINER HELPER FUNCTION
-- ================================================================
-- Checks if a user is an active admin of a given shop.
-- SECURITY DEFINER = runs as function owner, bypasses RLS.
-- This is the ONLY safe way to query shop_memberships from
-- within a policy ON shop_memberships.

CREATE OR REPLACE FUNCTION public.is_shop_admin(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_memberships
    WHERE user_id = auth.uid()
      AND shop_id = target_shop_id
      AND role = 'admin'
      AND is_active = true
  );
$function$;

-- ================================================================
-- 2. DROP RECURSIVE ALL POLICY
-- ================================================================
-- This policy's subqueries on shop_memberships cause infinite
-- recursion. Must be dropped before creating replacements.

DROP POLICY IF EXISTS "Shop memberships write by shop membership admin" ON public.shop_memberships;

-- ================================================================
-- 3. CREATE NON-RECURSIVE REPLACEMENT POLICIES
-- ================================================================
-- Each policy calls is_shop_admin() (SECURITY DEFINER) instead of
-- querying shop_memberships directly. No recursion possible.

-- INSERT: admins can add members to their shops
CREATE POLICY "Shop memberships insert by shop admin" ON public.shop_memberships
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND public.is_shop_admin(shop_id)
  );

-- UPDATE: admins can modify memberships in their shops
CREATE POLICY "Shop memberships update by shop admin" ON public.shop_memberships
  FOR UPDATE USING (
    (auth.role() = 'authenticated'::text)
    AND public.is_shop_admin(shop_id)
  );

-- DELETE: admins can remove members from their shops
CREATE POLICY "Shop memberships delete by shop admin" ON public.shop_memberships
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND public.is_shop_admin(shop_id)
  );

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Test: should return own memberships (uses SELECT policy, no recursion)
-- SELECT * FROM shop_memberships WHERE user_id = auth.uid();

-- Test: other tables should still work (they use current_shop_ids)
-- SELECT * FROM products LIMIT 1;
-- SELECT * FROM customers LIMIT 1;

-- Test: verify no recursion error on INSERT
-- INSERT INTO shop_memberships (user_id, shop_id, role, is_active)
-- VALUES ('some-user-id', 'some-shop-id', 'cashier', true);

-- Verify policies are correct:
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE tablename = 'shop_memberships' ORDER BY policyname;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
