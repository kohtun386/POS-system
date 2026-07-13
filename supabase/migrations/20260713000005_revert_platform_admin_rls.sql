-- ================================================================
-- Migration: Revert Platform Admin RLS Policies
-- Date: July 13, 2026
-- Description:
--   Removes platform_admin from RLS policies added in migration
--   20260713000002. Now that the Platform Admin UI routes through
--   Edge Functions with service_role (bypasses RLS), platform_admin
--   should NOT appear in any RLS policies (auth.md §5, §3.2).
--
--   Hybrid approach:
--   - Shop-scoped tables: REMOVE platform_admin, keep admin/manager
--   - Feature definitions: DROP all write policies (platform_admin
--     only, via Edge Functions)
--   - Users.role CHECK constraint: KEEP platform_admin (needed for
--     auth to work — platform_admin is a valid role in users table)
-- ================================================================

-- ================================================================
-- 1. Feature Definitions: DROP write policy entirely
--    §5.8: "INSERT/UPDATE/DELETE: platform_admin only via Edge Function
--    No RLS policy"
-- ================================================================
DROP POLICY IF EXISTS "Feature definitions writable by platform_admin"
  ON feature_definitions;

-- ================================================================
-- 2. Products: Remove platform_admin from INSERT/UPDATE/DELETE policies
-- ================================================================
DROP POLICY IF EXISTS "Products insert by admin/manager" ON products;
CREATE POLICY "Products insert by admin/manager" ON products
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Products update by admin/manager" ON products;
CREATE POLICY "Products update by admin/manager" ON products
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Products delete by admin/manager" ON products;
CREATE POLICY "Products delete by admin/manager" ON products
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 3. Customers: Remove platform_admin from INSERT/UPDATE/DELETE
-- ================================================================
DROP POLICY IF EXISTS "Customers insert by admin/manager" ON customers;
CREATE POLICY "Customers insert by admin/manager" ON customers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Customers update by admin/manager" ON customers;
CREATE POLICY "Customers update by admin/manager" ON customers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Customers delete by admin/manager" ON customers;
CREATE POLICY "Customers delete by admin/manager" ON customers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 4. Sales: Remove platform_admin from INSERT/UPDATE/DELETE
-- ================================================================
DROP POLICY IF EXISTS "Sales insert by admin/manager" ON sales;
CREATE POLICY "Sales insert by admin/manager" ON sales
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Sales update by admin/manager" ON sales;
CREATE POLICY "Sales update by admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Sales delete by admin/manager" ON sales;
CREATE POLICY "Sales delete by admin/manager" ON sales
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 5. Categories: Remove platform_admin from INSERT/UPDATE/DELETE
-- ================================================================
DROP POLICY IF EXISTS "Categories insert by admin/manager" ON categories;
CREATE POLICY "Categories insert by admin/manager" ON categories
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Categories update by admin/manager" ON categories;
CREATE POLICY "Categories update by admin/manager" ON categories
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Categories delete by admin/manager" ON categories;
CREATE POLICY "Categories delete by admin/manager" ON categories
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 6. Suppliers: Remove platform_admin from INSERT/UPDATE/DELETE
-- ================================================================
DROP POLICY IF EXISTS "Suppliers insert by admin/manager" ON suppliers;
CREATE POLICY "Suppliers insert by admin/manager" ON suppliers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Suppliers update by admin/manager" ON suppliers;
CREATE POLICY "Suppliers update by admin/manager" ON suppliers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Suppliers delete by admin/manager" ON suppliers;
CREATE POLICY "Suppliers delete by admin/manager" ON suppliers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 7. Discounts: Remove platform_admin from INSERT/UPDATE/DELETE
-- ================================================================
DROP POLICY IF EXISTS "Discounts insert by admin/manager" ON discounts;
CREATE POLICY "Discounts insert by admin/manager" ON discounts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Discounts update by admin/manager" ON discounts;
CREATE POLICY "Discounts update by admin/manager" ON discounts
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Discounts delete by admin/manager" ON discounts;
CREATE POLICY "Discounts delete by admin/manager" ON discounts
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 8. App Settings: Remove platform_admin from write policy
-- ================================================================
DROP POLICY IF EXISTS "App settings write by admin/manager" ON app_settings;
CREATE POLICY "App settings write by admin/manager" ON app_settings
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 9. Cash Shifts: Remove platform_admin bypass branch
--    §5.12: Shop-scoped only — no platform_admin override
-- ================================================================
DROP POLICY IF EXISTS "Cash shifts write by shop admin" ON cash_shifts;
CREATE POLICY "Cash shifts write by shop admin" ON cash_shifts
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = cash_shifts.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 10. KEEP users_role_check constraint WITH platform_admin
--     Platform_admin is a valid role in the users table.
--     It just shouldn't appear in RLS policies.
--     (No change needed — migration 002 already added it.)
-- ================================================================

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Confirm no RLS policy references platform_admin:
-- SELECT policyname, tablename
-- FROM pg_policies
-- WHERE qual LIKE '%platform_admin%' OR with_check LIKE '%platform_admin%';
-- Expected: 0 rows

-- Confirm feature_definitions has no write policy:
-- SELECT policyname, tablename, cmd
-- FROM pg_policies WHERE tablename = 'feature_definitions' AND cmd != 'SELECT';
-- Expected: 0 rows

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
