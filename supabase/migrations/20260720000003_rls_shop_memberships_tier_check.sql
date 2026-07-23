-- ================================================================
-- RLS: Shop Memberships Tier Enforcement
-- Generated on: July 23, 2026
-- Description:
--   Restricts INSERT on shop_memberships based on subscription_tier.
--   Prevents Free Tier shops from creating staff accounts at the
--   database level (defense-in-depth beyond frontend capability gating).
--
--   Also cleans up old permissive policies that were never dropped:
--   - "Shop memberships viewable by all authenticated" (20260620000001)
--   - "Shop memberships write by all authenticated" (20260620000001)
--   - "Shop memberships write by shop membership admin" (20260717000002)
--
--   Per VISION.md §3.2: Staff Accounts = Free ❌, Growth ✅, Pro ✅
--   Per VISION.md §5.5: staff_accounts min_tier = growth
--
--   ⚠️ RLS Recursion Avoidance:
--   These policies do NOT call current_shop_ids() (which queries
--   shop_memberships). Direct aliased subqueries are used instead.
-- ================================================================

-- ================================================================
-- 1. DROP ALL EXISTING POLICIES ON shop_memberships
--    Names verified against live pg_policies (2026-07-23)
-- ================================================================

DROP POLICY IF EXISTS "Shop memberships viewable by own user" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships insert by shop admin" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships update by shop admin" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships delete by shop admin" ON public.shop_memberships;

-- Also clean up old policy names from previous migrations in case they linger
DROP POLICY IF EXISTS "Shop memberships viewable by all authenticated" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships write by all authenticated" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships write by shop membership admin" ON public.shop_memberships;
DROP POLICY IF EXISTS "Shop memberships write by global admin" ON public.shop_memberships;

-- Drop the is_shop_admin helper function used by old policies
-- New policies use direct aliased subqueries instead (avoids RLS recursion)
DROP FUNCTION IF EXISTS public.is_shop_admin(uuid);

-- ================================================================
-- 2. CREATE NEW POLICIES
-- ================================================================

-- 2a. SELECT policy: any authenticated user can view memberships
--     for shops they belong to. This is needed for the app to
--     load the current user's shop memberships at login.
CREATE POLICY "Shop memberships select for own shops" ON public.shop_memberships
  FOR SELECT USING (
    auth.role() = 'authenticated'::text
    AND (
      -- User can see their own memberships
      user_id = auth.uid()
      OR
      -- Or user is an admin/manager in the same shop
      EXISTS (
        SELECT 1 FROM public.shop_memberships AS sm_admin
        WHERE sm_admin.user_id = auth.uid()
        AND sm_admin.shop_id = shop_memberships.shop_id
        AND sm_admin.role IN ('admin'::text, 'manager'::text)
        AND sm_admin.is_active = true
      )
    )
  );

-- 2b. INSERT policy: tier-gated
--     - First membership (owner signup): always allowed regardless of tier
--     - Additional memberships: only if shop is Growth+ tier
--     - Caller must be admin in the target shop
CREATE POLICY "Shop memberships insert with tier check" ON public.shop_memberships
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'::text
    AND shop_id IS NOT NULL
    AND (
      -- Allow first membership (owner signup) regardless of tier
      (SELECT COUNT(*) FROM public.shop_memberships AS sm_count
       WHERE sm_count.shop_id = shop_memberships.shop_id) = 0
      OR
      -- Allow additional memberships only for Growth+ shops
      EXISTS (
        SELECT 1 FROM public.shops AS s
        WHERE s.id = shop_memberships.shop_id
        AND s.subscription_tier IN ('growth'::text, 'pro'::text)
      )
    )
    AND
    -- Caller must be admin in the target shop (except for first membership)
    (
      (SELECT COUNT(*) FROM public.shop_memberships AS sm_count
       WHERE sm_count.shop_id = shop_memberships.shop_id) = 0
      OR
      EXISTS (
        SELECT 1 FROM public.shop_memberships AS sm_admin
        WHERE sm_admin.user_id = auth.uid()
        AND sm_admin.shop_id = shop_memberships.shop_id
        AND sm_admin.role = 'admin'::text
        AND sm_admin.is_active = true
      )
    )
  );

-- 2c. UPDATE policy: admin-only in the target shop
CREATE POLICY "Shop memberships update by shop admin" ON public.shop_memberships
  FOR UPDATE USING (
    auth.role() = 'authenticated'::text
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships AS sm_admin
      WHERE sm_admin.user_id = auth.uid()
      AND sm_admin.shop_id = shop_memberships.shop_id
      AND sm_admin.role = 'admin'::text
      AND sm_admin.is_active = true
    )
  );

-- 2d. DELETE policy: admin-only in the target shop
CREATE POLICY "Shop memberships delete by shop admin" ON public.shop_memberships
  FOR DELETE USING (
    auth.role() = 'authenticated'::text
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships AS sm_admin
      WHERE sm_admin.user_id = auth.uid()
      AND sm_admin.shop_id = shop_memberships.shop_id
      AND sm_admin.role = 'admin'::text
      AND sm_admin.is_active = true
    )
  );

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Verify current policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies WHERE tablename = 'shop_memberships';

-- Test: Free Tier shop admin should NOT be able to insert additional memberships
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- INSERT INTO shop_memberships (user_id, shop_id, role, is_active)
-- VALUES ('some-uuid', 'free-shop-uuid', 'cashier', true);
-- ROLLBACK;
-- Expected: ERROR (new row violates row-level security policy)

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
