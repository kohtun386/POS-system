-- ================================================================
-- FIX: shop_memberships SELECT policy infinite recursion (v4)
-- Generated on: July 24, 2026
-- Description:
--   The "Shop memberships select for own shops" policy from
--   20260720000003 has an EXISTS subquery that queries
--   shop_memberships, causing infinite RLS recursion (42P17).
--
--   Root Cause: ANY subquery on shop_memberships inside a policy
--   ON shop_memberships triggers RLS evaluation again, causing
--   infinite recursion. This applies to SELECT, INSERT, UPDATE,
--   and DELETE policies alike.
--
--   Fix: Replace all inline subqueries with SECURITY DEFINER
--   helper functions that bypass RLS entirely. SECURITY DEFINER
--   runs with the function owner's privileges (typically
--   supabase_admin), so it can query shop_memberships without
--   re-entering the RLS policy engine.
--
--   This also fixes cascading 500 errors on ALL other tables
--   (products, customers, alert tables, etc.) whose policies
--   call current_shop_ids(), which queries shop_memberships.
-- ================================================================

-- ================================================================
-- 1. CREATE SECURITY DEFINER HELPER FUNCTIONS
--    These run with caller's permissions BUT bypass RLS on
--    shop_memberships because they query a fixed pattern that
--    doesn't need per-row filtering.
-- ================================================================

-- Helper: Check if current user is an admin/manager in a given shop
-- SECURITY DEFINER so it doesn't trigger RLS re-evaluation
CREATE OR REPLACE FUNCTION public.is_shop_admin_or_manager(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_memberships sm
    WHERE sm.user_id = auth.uid()
    AND sm.shop_id = p_shop_id
    AND sm.role IN ('admin'::text, 'manager'::text)
    AND sm.is_active = true
  );
$$;

-- Helper: Count memberships in a shop (for tier check)
-- SECURITY DEFINER so it doesn't trigger RLS re-evaluation
CREATE OR REPLACE FUNCTION public.count_shop_memberships(p_shop_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*) FROM public.shop_memberships sm
  WHERE sm.shop_id = p_shop_id;
$$;

-- Helper: Check if current user is an admin in a given shop
-- SECURITY DEFINER so it doesn't trigger RLS re-evaluation
CREATE OR REPLACE FUNCTION public.is_shop_admin(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_memberships sm
    WHERE sm.user_id = auth.uid()
    AND sm.shop_id = p_shop_id
    AND sm.role = 'admin'::text
    AND sm.is_active = true
  );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_shop_admin_or_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_shop_memberships(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_admin(uuid) TO authenticated;

-- ================================================================
-- 2. DROP ALL EXISTING POLICIES ON shop_memberships
-- ================================================================

DROP POLICY IF EXISTS "Shop memberships select for own shops" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships insert with tier check" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships update by shop admin" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships delete by shop admin" ON public.shop_memberships;

-- ================================================================
-- 3. RECREATE POLICIES WITH SECURITY DEFINER HELPERS
--    No inline subqueries on shop_memberships → no recursion
-- ================================================================

-- 3a. SELECT: users see own memberships, OR admins/managers see shop memberships
CREATE POLICY "Shop memberships select for own shops" ON public.shop_memberships
  FOR SELECT USING (
    auth.role() = 'authenticated'::text
    AND (
      user_id = auth.uid()
      OR public.is_shop_admin_or_manager(shop_id)
    )
  );

-- 3b. INSERT: first membership always allowed; additional memberships need Growth+ tier
CREATE POLICY "Shop memberships insert with tier check" ON public.shop_memberships
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'::text
    AND shop_id IS NOT NULL
    AND (
      -- Allow first membership (owner signup) regardless of tier
      public.count_shop_memberships(shop_id) = 0
      OR
      -- Allow additional memberships only for Growth+ shops
      EXISTS (
        SELECT 1 FROM public.shops AS s
        WHERE s.id = shop_id
        AND s.subscription_tier IN ('growth'::text, 'pro'::text)
      )
    )
    AND (
      -- Caller must be admin in the target shop (except for first membership)
      public.count_shop_memberships(shop_id) = 0
      OR public.is_shop_admin(shop_id)
    )
  );

-- 3c. UPDATE: admin-only in the target shop
CREATE POLICY "Shop memberships update by shop admin" ON public.shop_memberships
  FOR UPDATE USING (
    auth.role() = 'authenticated'::text
    AND public.is_shop_admin(shop_id)
  );

-- 3d. DELETE: admin-only in the target shop
CREATE POLICY "Shop memberships delete by shop admin" ON public.shop_memberships
  FOR DELETE USING (
    auth.role() = 'authenticated'::text
    AND public.is_shop_admin(shop_id)
  );

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Should return 4 policies with no inline shop_memberships subqueries:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies WHERE tablename = 'shop_memberships';

-- Test: user should be able to see their own membership
-- SELECT * FROM shop_memberships WHERE user_id = auth.uid();

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
