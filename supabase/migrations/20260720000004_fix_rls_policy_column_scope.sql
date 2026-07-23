-- ================================================================
-- FIX: RLS shop_memberships INSERT policy column scoping
-- Generated on: July 23, 2026
-- Description:
--   The "Shop memberships insert with tier check" policy from
--   20260720000003 has a PostgreSQL column scoping bug: inside
--   the subquery, unqualified `shop_id` resolves to the subquery's
--   own alias (sm_count.shop_id = sm_count.shop_id), which is
--   always true. This makes the "first membership" exception dead
--   code.
--
--   Fix: Use qualified shop_memberships.shop_id to reference the
--   outer table's NEW row value. Also fix the admin check subquery
--   for consistency.
-- ================================================================

-- ================================================================
-- 1. DROP THE BROKEN POLICY
-- ================================================================

DROP POLICY IF EXISTS "Shop memberships insert with tier check" ON public.shop_memberships;

-- ================================================================
-- 2. RE-CREATE WITH CORRECTED COLUMN REFERENCES
-- ================================================================

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

-- ================================================================
-- VERIFICATION QUERY
-- ================================================================

-- Confirm WITH CHECK now references shop_memberships.shop_id (not sm_count.shop_id):
-- SELECT policyname, with_check FROM pg_policies
-- WHERE tablename = 'shop_memberships' AND cmd = 'INSERT';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
