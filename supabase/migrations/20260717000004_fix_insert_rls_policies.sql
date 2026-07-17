-- ================================================================
-- FIX: Residual INSERT policies still checking users.role
-- Generated on: July 17, 2026
-- Description:
--   Migration 20260717000002 attempted to drop old users.role-based
--   INSERT policies but 8 survived (likely recreated by remote schema
--   sync). These policies block all data creation for users whose
--   users.role != 'admin', even if their shop_memberships.role = 'admin'.
--
--   This migration:
--   1. DROPs all 8 residual users.role INSERT policies
--   2. CREATEs correct replacements using shop_memberships.role
--   3. Backfills mismatched users.role from shop_memberships.role
--
--   VISION.md §4.2: shop_memberships.role is the canonical source.
-- ================================================================

-- ================================================================
-- PHASE 1: Drop residual users.role INSERT policies
-- ================================================================

DROP POLICY IF EXISTS "Categories insert by admin/manager" ON public.categories;
DROP POLICY IF EXISTS "Customers insert by admin/manager" ON public.customers;
DROP POLICY IF EXISTS "Customers insert by shop admin/manager" ON public.customers;
DROP POLICY IF EXISTS "Discounts insert by admin/manager" ON public.discounts;
DROP POLICY IF EXISTS "Products insert by admin/manager" ON public.products;
DROP POLICY IF EXISTS "Products insert by shop admin/manager" ON public.products;
DROP POLICY IF EXISTS "Sales insert by admin/manager" ON public.sales;
DROP POLICY IF EXISTS "Suppliers insert by admin/manager" ON public.suppliers;

-- ================================================================
-- PHASE 2: Create correct INSERT policies using shop_memberships.role
-- Pattern: shop-scoped (current_shop_ids) + membership role check
-- ================================================================

-- 1. categories
CREATE POLICY "Categories insert by shop membership role" ON public.categories
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 2. customers
CREATE POLICY "Customers insert by shop membership role" ON public.customers
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 3. discounts
CREATE POLICY "Discounts insert by shop membership role" ON public.discounts
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 4. products
CREATE POLICY "Products insert by shop membership role" ON public.products
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 5. sales
CREATE POLICY "Sales insert by shop membership role" ON public.sales
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 6. suppliers
CREATE POLICY "Suppliers insert by shop membership role" ON public.suppliers
  FOR INSERT WITH CHECK (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- ================================================================
-- PHASE 3: Backfill mismatched roles
-- Sync users.role from shop_memberships.role for active memberships
-- ================================================================

UPDATE public.users u
SET role = sm.role
FROM public.shop_memberships sm
WHERE u.id = sm.user_id
  AND sm.is_active = true
  AND u.role != sm.role;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Should return 0 rows (no more users.role INSERT policies):
-- SELECT count(*) FROM pg_policies
-- WHERE schemaname = 'public'
--   AND cmd = 'INSERT'
--   AND with_check::text LIKE '%users.role%';

-- Should return 0 rows (no role mismatches):
-- SELECT u.email, u.role AS users_role, sm.role AS membership_role
-- FROM public.users u
-- JOIN public.shop_memberships sm ON u.id = sm.user_id
-- WHERE sm.is_active = true AND u.role != sm.role;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
