-- ================================================================
-- PRODUCTION SECURITY: Role-Aware RLS + Card Data Purge
-- Generated on: June 18, 2026
-- Description:
--   1. Replace blanket auth.role()='authenticated' policies with
--      role-aware policies on products, customers, and sales.
--   2. Sanitize existing card_details JSONB to strip cardNumber.
--   3. Fix users table SELECT to not be publicly readable.
-- ================================================================

-- ================================================================
-- 1. DROP OLD BLANKET RLS POLICIES
-- ================================================================

-- Products — old blanket policies
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON products;
DROP POLICY IF EXISTS "Products are editable by authenticated users" ON products;

-- Customers — old blanket policies
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;
DROP POLICY IF EXISTS "Customers are editable by authenticated users" ON customers;

-- Sales — old blanket policies
DROP POLICY IF EXISTS "Sales are viewable by authenticated users" ON sales;
DROP POLICY IF EXISTS "Sales are editable by authenticated users" ON sales;

-- Users — fix public read
DROP POLICY IF EXISTS "Users are publicly viewable" ON users;

-- App Settings — restrict writes
DROP POLICY IF EXISTS "App settings are editable by authenticated users" ON app_settings;
DROP POLICY IF EXISTS "App settings are viewable by authenticated users" ON app_settings;

-- Categories — old blanket policies
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON categories;
DROP POLICY IF EXISTS "Categories are editable by authenticated users" ON categories;

-- Suppliers — old blanket policies
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users" ON suppliers;
DROP POLICY IF EXISTS "Suppliers are editable by authenticated users" ON suppliers;

-- Discounts — old blanket policies
DROP POLICY IF EXISTS "Discounts are viewable by authenticated users" ON discounts;
DROP POLICY IF EXISTS "Discounts are editable by authenticated users" ON discounts;

-- Product Batches — old blanket policies
DROP POLICY IF EXISTS "Product batches are viewable by authenticated users" ON product_batches;
DROP POLICY IF EXISTS "Product batches are editable by authenticated users" ON product_batches;

-- ================================================================
-- 2. ROLE-AWARE RLS POLICIES
--    Pattern: ALL roles can SELECT. Only admin/manager can INSERT/UPDATE/DELETE.
--    Cashiers can INSERT sales (they need to record transactions).
-- ================================================================

-- ——— USERS ———
-- Only authenticated users can read user list (was publicly readable)
CREATE POLICY "Users viewable by authenticated users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ——— APP SETTINGS ———
-- Readable by all authenticated, writable only by admin/manager
CREATE POLICY "App settings viewable by all authenticated" ON app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "App settings write by admin/manager" ON app_settings
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— PRODUCTS ———
CREATE POLICY "Products viewable by all authenticated" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Products insert by admin/manager" ON products
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Products update by admin/manager" ON products
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Products delete by admin/manager" ON products
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— CUSTOMERS ———
CREATE POLICY "Customers viewable by all authenticated" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Customers insert by admin/manager" ON customers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Customers update by admin/manager" ON customers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Customers delete by admin/manager" ON customers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— SALES ———
-- Cashiers must be able to create sales (core POS function).
-- Only admin/manager can update or delete sales.

CREATE POLICY "Sales viewable by all authenticated" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sales insert by all authenticated" ON sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Sales update by admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Sales delete by admin/manager" ON sales
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— CATEGORIES ———
CREATE POLICY "Categories viewable by all authenticated" ON categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Categories write by admin/manager" ON categories
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— SUPPLIERS ———
CREATE POLICY "Suppliers viewable by all authenticated" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Suppliers write by admin/manager" ON suppliers
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— DISCOUNTS ———
CREATE POLICY "Discounts viewable by all authenticated" ON discounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Discounts write by admin/manager" ON discounts
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ——— PRODUCT BATCHES ———
CREATE POLICY "Product batches viewable by all authenticated" ON product_batches
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Product batches write by admin/manager" ON product_batches
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- ================================================================
-- 3. SANITIZE CARD DATA — Strip cardNumber from all existing JSONB
-- ================================================================

-- Remove cardNumber key from sales.card_details JSONB
UPDATE sales
SET card_details = card_details - 'cardNumber'
WHERE card_details ? 'cardNumber';

-- Remove cardNumber from payments array (nested inside sales.payments JSONB)
-- Each payment object inside the payments array may have a cardDetails object.
-- This updates each element in the JSONB array.
UPDATE sales
SET payments = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->'cardDetails' ? 'cardNumber'
      THEN jsonb_set(elem, '{cardDetails}', (elem->'cardDetails') - 'cardNumber')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(payments) AS elem
)
WHERE payments IS NOT NULL
  AND jsonb_path_exists(payments, '$[*].cardDetails.cardNumber');

-- ================================================================
-- 4. VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Verify no cardNumber remains in card_details:
-- SELECT COUNT(*) FROM sales WHERE card_details ? 'cardNumber';
-- Expected: 0

-- Verify RLS policies exist:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ================================================================
-- SECURITY PATCH COMPLETE
-- ================================================================
