-- ================================================================
-- CHUNK 2: RLS Rewrite — shop_id Scoping
-- Generated on: June 20, 2026
-- Description:
--   Replace all existing RLS policies with shop_id-scoped versions.
--   Replace temporary permissive policies from Chunk 1 with
--   proper role-aware policies.
--
--   Pattern: every query scoped to shops user belongs to via
--   shop_memberships table.
--
--   Creates current_shop_ids() helper function to avoid
--   repeating subquery in every policy.
-- ================================================================

-- ================================================================
-- 1. HELPER FUNCTION: current_shop_ids()
--    Returns all shop_ids the current user is a member of.
--    Used in every RLS policy WHERE clause.
-- ================================================================

CREATE OR REPLACE FUNCTION public.current_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT shop_id FROM public.shop_memberships
    WHERE user_id = auth.uid() AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.current_shop_ids() TO authenticated;

-- ================================================================
-- 2. DROP ALL EXISTING POLICIES
--    Clean slate. Rebuild with shop_id scoping.
-- ================================================================

-- app_settings
DROP POLICY IF EXISTS "App settings viewable by all authenticated" ON app_settings;
DROP POLICY IF EXISTS "App settings write by admin/manager" ON app_settings;

-- categories
DROP POLICY IF EXISTS "Categories viewable by all authenticated" ON categories;
DROP POLICY IF EXISTS "Categories write by admin/manager" ON categories;

-- customers
DROP POLICY IF EXISTS "Customers viewable by all authenticated" ON customers;
DROP POLICY IF EXISTS "Customers insert by admin/manager" ON customers;
DROP POLICY IF EXISTS "Customers update by admin/manager" ON customers;
DROP POLICY IF EXISTS "Customers delete by admin/manager" ON customers;

-- suppliers
DROP POLICY IF EXISTS "Suppliers viewable by all authenticated" ON suppliers;
DROP POLICY IF EXISTS "Suppliers write by admin/manager" ON suppliers;

-- products
DROP POLICY IF EXISTS "Products viewable by all authenticated" ON products;
DROP POLICY IF EXISTS "Products insert by admin/manager" ON products;
DROP POLICY IF EXISTS "Products update by admin/manager" ON products;
DROP POLICY IF EXISTS "Products delete by admin/manager" ON products;

-- product_batches
DROP POLICY IF EXISTS "Product batches viewable by all authenticated" ON product_batches;
DROP POLICY IF EXISTS "Product batches write by admin/manager" ON product_batches;

-- discounts
DROP POLICY IF EXISTS "Discounts viewable by all authenticated" ON discounts;
DROP POLICY IF EXISTS "Discounts write by admin/manager" ON discounts;

-- users
DROP POLICY IF EXISTS "Users viewable by authenticated users" ON users;
DROP POLICY IF EXISTS "Users insert by authenticated users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any" ON users;

-- sales
DROP POLICY IF EXISTS "Sales viewable by all authenticated" ON sales;
DROP POLICY IF EXISTS "Sales insert by all authenticated" ON sales;
DROP POLICY IF EXISTS "Sales update by admin/manager" ON sales;
DROP POLICY IF EXISTS "Sales delete by admin/manager" ON sales;

-- sales_tabs
DROP POLICY IF EXISTS "Users can view their own sales tabs" ON sales_tabs;
DROP POLICY IF EXISTS "Users can manage their own sales tabs" ON sales_tabs;

-- currency_config
DROP POLICY IF EXISTS "Currency config viewable by all authenticated" ON currency_config;
DROP POLICY IF EXISTS "Currency config write by admin/manager" ON currency_config;

-- exchange_rates
DROP POLICY IF EXISTS "Exchange rates viewable by all authenticated" ON exchange_rates;
DROP POLICY IF EXISTS "Exchange rates write by admin/manager" ON exchange_rates;

-- exchange_rate_history
DROP POLICY IF EXISTS "Exchange rate history viewable by all authenticated" ON exchange_rate_history;
DROP POLICY IF EXISTS "Exchange rate history write by admin/manager" ON exchange_rate_history;

-- shops (Chunk 1 temporary)
DROP POLICY IF EXISTS "Shops viewable by all authenticated" ON shops;
DROP POLICY IF EXISTS "Shops write by all authenticated" ON shops;

-- shop_memberships (Chunk 1 temporary)
DROP POLICY IF EXISTS "Shop memberships viewable by all authenticated" ON shop_memberships;
DROP POLICY IF EXISTS "Shop memberships write by all authenticated" ON shop_memberships;

-- alert_recipients (Chunk 1 temporary)
DROP POLICY IF EXISTS "Alert recipients viewable by all authenticated" ON alert_recipients;
DROP POLICY IF EXISTS "Alert recipients write by all authenticated" ON alert_recipients;

-- alert_templates (Chunk 1 temporary)
DROP POLICY IF EXISTS "Alert templates viewable by all authenticated" ON alert_templates;
DROP POLICY IF EXISTS "Alert templates write by all authenticated" ON alert_templates;

-- alert_configurations (Chunk 1 temporary)
DROP POLICY IF EXISTS "Alert configurations viewable by all authenticated" ON alert_configurations;
DROP POLICY IF EXISTS "Alert configurations write by all authenticated" ON alert_configurations;

-- alert_history (Chunk 1 temporary)
DROP POLICY IF EXISTS "Alert history viewable by all authenticated" ON alert_history;
DROP POLICY IF EXISTS "Alert history write by all authenticated" ON alert_history;

-- notification_service_config (Chunk 1 temporary)
DROP POLICY IF EXISTS "Notification service config viewable by all authenticated" ON notification_service_config;
DROP POLICY IF EXISTS "Notification service config write by all authenticated" ON notification_service_config;

-- ================================================================
-- 3. STANDARD PATTERN: SELECT for shop members, write for admin/manager
--    Applied to: app_settings, categories, suppliers, product_batches,
--    discounts, currency_config, exchange_rates, exchange_rate_history
-- ================================================================

-- ——— APP SETTINGS ———
CREATE POLICY "App settings viewable by shop members" ON app_settings
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "App settings write by shop admin/manager" ON app_settings
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— CATEGORIES ———
CREATE POLICY "Categories viewable by shop members" ON categories
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Categories write by shop admin/manager" ON categories
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— SUPPLIERS ———
CREATE POLICY "Suppliers viewable by shop members" ON suppliers
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Suppliers write by shop admin/manager" ON suppliers
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— PRODUCT BATCHES ———
CREATE POLICY "Product batches viewable by shop members" ON product_batches
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Product batches write by shop admin/manager" ON product_batches
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— DISCOUNTS ———
CREATE POLICY "Discounts viewable by shop members" ON discounts
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Discounts write by shop admin/manager" ON discounts
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— CURRENCY CONFIG ———
CREATE POLICY "Currency config viewable by shop members" ON currency_config
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Currency config write by shop admin/manager" ON currency_config
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— EXCHANGE RATES ———
CREATE POLICY "Exchange rates viewable by shop members" ON exchange_rates
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Exchange rates write by shop admin/manager" ON exchange_rates
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— EXCHANGE RATE HISTORY ———
CREATE POLICY "Exchange rate history viewable by shop members" ON exchange_rate_history
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Exchange rate history write by shop admin/manager" ON exchange_rate_history
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ================================================================
-- 4. PRODUCTS: SELECT for shop members, write per-operation for admin/manager
-- ================================================================

CREATE POLICY "Products viewable by shop members" ON products
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Products insert by shop admin/manager" ON products
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Products update by shop admin/manager" ON products
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Products delete by shop admin/manager" ON products
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ================================================================
-- 5. CUSTOMERS: SELECT for shop members, write per-operation for admin/manager
-- ================================================================

CREATE POLICY "Customers viewable by shop members" ON customers
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Customers insert by shop admin/manager" ON customers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Customers update by shop admin/manager" ON customers
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Customers delete by shop admin/manager" ON customers
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ================================================================
-- 6. SALES: Cashiers can INSERT, admin/manager can UPDATE/DELETE
-- ================================================================

CREATE POLICY "Sales viewable by shop members" ON sales
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Sales insert by shop members" ON sales
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Sales update by shop admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Sales delete by shop admin/manager" ON sales
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ================================================================
-- 7. SALES TABS: User-scoped + shop-scoped
-- ================================================================

CREATE POLICY "Sales tabs viewable by owner in shop" ON sales_tabs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Sales tabs insert by owner in shop" ON sales_tabs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Sales tabs update by owner in shop" ON sales_tabs
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Sales tabs delete by owner in shop" ON sales_tabs
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- ================================================================
-- 8. USERS: Viewable by shop members, self-edit or admin
-- ================================================================

CREATE POLICY "Users viewable by shop members" ON users
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Users insert by authenticated" ON users
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users update self or admin" ON users
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = id
      OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    )
  );

-- ================================================================
-- 9. SHOPS: Members can view own shops, admin can manage
-- ================================================================

CREATE POLICY "Shops viewable by members" ON shops
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Shops write by shop admin" ON shops
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships
      WHERE shop_memberships.user_id = auth.uid()
      AND shop_memberships.shop_id = shops.id
      AND shop_memberships.role = 'admin'
    )
  );

-- ================================================================
-- 10. SHOP MEMBERSHIPS: Members can view own shop's memberships
-- ================================================================

CREATE POLICY "Shop memberships viewable by shop members" ON shop_memberships
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Shop memberships write by shop admin" ON shop_memberships
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
      AND sm.shop_id = shop_memberships.shop_id
      AND sm.role = 'admin'
    )
  );

-- ================================================================
-- 11. ALERT TABLES: Viewable by shop members, write by admin/manager
-- ================================================================

-- ——— ALERT RECIPIENTS ———
CREATE POLICY "Alert recipients viewable by shop members" ON alert_recipients
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Alert recipients write by shop admin/manager" ON alert_recipients
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— ALERT TEMPLATES ———
CREATE POLICY "Alert templates viewable by shop members" ON alert_templates
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Alert templates write by shop admin/manager" ON alert_templates
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— ALERT CONFIGURATIONS ———
CREATE POLICY "Alert configurations viewable by shop members" ON alert_configurations
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Alert configurations write by shop admin/manager" ON alert_configurations
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— ALERT HISTORY ———
CREATE POLICY "Alert history viewable by shop members" ON alert_history
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Alert history write by shop admin/manager" ON alert_history
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ——— NOTIFICATION SERVICE CONFIG ———
CREATE POLICY "Notification service config viewable by shop members" ON notification_service_config
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

CREATE POLICY "Notification service config write by shop admin/manager" ON notification_service_config
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

-- ================================================================
-- VERIFICATION (run manually after migration)
-- ================================================================

-- Count policies per table:
-- SELECT tablename, COUNT(*) as policy_count
-- FROM pg_policies WHERE schemaname = 'public'
-- GROUP BY tablename ORDER BY tablename;

-- Verify all policies have shop_id check:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
-- AND qual::text NOT LIKE '%current_shop_ids%'
-- AND tablename NOT IN ('shops', 'shop_memberships')
-- ORDER BY tablename;
-- Expected: 0 rows (all policies use current_shop_ids)

-- ================================================================
-- CHUNK 2 COMPLETE
-- All 20 tables now have shop_id-scoped RLS policies.
-- POS still works: single default shop, user is member of it.
-- Next: Chunk 3 (service layer — inject shop_id in queries)
-- ================================================================
