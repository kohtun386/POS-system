-- ================================================================
-- Migration: Platform Admin RLS Access
-- Date: July 13, 2026
-- Description:
--   Fixes the platform_admin security boundary so platform admin
--   users can write to the database. Two issues:
--
--   1. The users.role CHECK constraint only allows
--      ('admin','manager','cashier') — platform_admin can't be
--      inserted into the users table.
--
--   2. RLS policies for feature_definitions check users.role = 'admin'
--      (exact string match) instead of IN ('admin','platform_admin'),
--      so platform admins are blocked from writing feature definitions.
--
--   3. The shops role_aware_rls migration already uses
--      users.role IN ('admin','manager') which doesn't include
--      platform_admin — platform admins can't write shop data.
-- ================================================================

-- ================================================================
-- 1. FIX users.role CHECK constraint
--    Drop old, add new with platform_admin included
-- ================================================================

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('platform_admin', 'admin', 'manager', 'cashier'));

-- ================================================================
-- 2. FIX feature_definitions RLS
--    Drop the admin-only write policy and replace with
--    one that includes platform_admin
-- ================================================================

-- Drop existing policies so we can recreate them cleanly
DROP POLICY IF EXISTS "Feature definitions writable by platform admin"
  ON feature_definitions;

-- Recreate: writable by platform_admin OR admin
CREATE POLICY "Feature definitions writable by platform_admin"
  ON feature_definitions
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin')
    )
  );

-- ================================================================
-- 3. FIX shop-level RLS policies across ALL tables
--    Tables using users.role IN ('admin','manager') need
--    platform_admin added so platform admins can write shop data.
--
--    Pattern: ALTER each policy to add platform_admin.
--    We DROP + recreate each policy since PostgreSQL doesn't
--    support ALTER POLICY ... USING.
-- ================================================================

-- Helper: platform_admin can do everything admin can.
-- We update all 'admin/manager' policies to include platform_admin.

-- === PRODUCTS ===
DROP POLICY IF EXISTS "Products insert by admin/manager" ON products;
CREATE POLICY "Products insert by admin/manager" ON products
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Products update by admin/manager" ON products;
CREATE POLICY "Products update by admin/manager" ON products
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Products delete by admin/manager" ON products;
CREATE POLICY "Products delete by admin/manager" ON products
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === CUSTOMERS ===
DROP POLICY IF EXISTS "Customers insert by admin/manager" ON customers;
CREATE POLICY "Customers insert by admin/manager" ON customers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Customers update by admin/manager" ON customers;
CREATE POLICY "Customers update by admin/manager" ON customers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Customers delete by admin/manager" ON customers;
CREATE POLICY "Customers delete by admin/manager" ON customers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === SALES ===
DROP POLICY IF EXISTS "Sales insert by admin/manager" ON sales;
CREATE POLICY "Sales insert by admin/manager" ON sales
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Sales update by admin/manager" ON sales;
CREATE POLICY "Sales update by admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Sales delete by admin/manager" ON sales;
CREATE POLICY "Sales delete by admin/manager" ON sales
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === CATEGORIES ===
DROP POLICY IF EXISTS "Categories insert by admin/manager" ON categories;
CREATE POLICY "Categories insert by admin/manager" ON categories
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Categories update by admin/manager" ON categories;
CREATE POLICY "Categories update by admin/manager" ON categories
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Categories delete by admin/manager" ON categories;
CREATE POLICY "Categories delete by admin/manager" ON categories
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === SUPPLIERS ===
DROP POLICY IF EXISTS "Suppliers insert by admin/manager" ON suppliers;
CREATE POLICY "Suppliers insert by admin/manager" ON suppliers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Suppliers update by admin/manager" ON suppliers;
CREATE POLICY "Suppliers update by admin/manager" ON suppliers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Suppliers delete by admin/manager" ON suppliers;
CREATE POLICY "Suppliers delete by admin/manager" ON suppliers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === DISCOUNTS ===
DROP POLICY IF EXISTS "Discounts insert by admin/manager" ON discounts;
CREATE POLICY "Discounts insert by admin/manager" ON discounts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Discounts update by admin/manager" ON discounts;
CREATE POLICY "Discounts update by admin/manager" ON discounts
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Discounts delete by admin/manager" ON discounts;
CREATE POLICY "Discounts delete by admin/manager" ON discounts
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === APP_SETTINGS ===
DROP POLICY IF EXISTS "App settings write by admin/manager" ON app_settings;
CREATE POLICY "App settings write by admin/manager" ON app_settings
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('platform_admin', 'admin', 'manager')
    )
  );

-- === CASH_SHIFTS ===
-- Cash shifts use shop_memberships role check; add platform_admin
-- bypass so platform admins can manage shifts in any shop.
-- Skip if cash_shifts table doesn't exist (not in v3.1.0 local schema).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cash_shifts' AND relkind = 'r') THEN
    DROP POLICY IF EXISTS "Cash shifts write by shop admin" ON cash_shifts;
    CREATE POLICY "Cash shifts write by shop admin" ON cash_shifts
      FOR ALL USING (
        auth.role() = 'authenticated'
        AND (
          -- Platform admin: can write to any shop's cash shifts
          EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.role = 'platform_admin'
          )
          OR
          -- Shop admin/manager: can write via membership
          (
            shop_id IN (SELECT public.current_shop_ids())
            AND EXISTS (
              SELECT 1 FROM public.shop_memberships sm
              WHERE sm.user_id = auth.uid()
                AND sm.shop_id = cash_shifts.shop_id
                AND sm.role IN ('admin', 'manager')
                AND sm.is_active = true
            )
          )
        )
      );
  END IF;
END $$;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Check users.role constraint includes platform_admin:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'users'::regclass
--   AND contype = 'c'
--   AND pg_get_constraintdef(oid) LIKE '%platform_admin%';
-- Expected: 1 row with users_role_check

-- Check feature_definitions RLS allows platform_admin:
-- SELECT policyname, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'feature_definitions' AND cmd = 'ALL';
-- Expected: policy uses role IN ('platform_admin', 'admin')

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
