-- ================================================================
-- RLS MIGRATION: Switch from users.role to shop_memberships.role
-- Generated on: July 17, 2026
-- Description:
--   Per VISION.md §4.2, shop_memberships.role is the canonical
--   role source. All 34 RLS policies previously checked users.role,
--   which was always 'cashier' for new signups (bug). This migration:
--
--   1. Adds new shop_memberships-based policies (Phase 1 - additive)
--   2. Drops old users.role-based policies (Phase 2 - cleanup)
--
--   Execution order: Phase 1 first (additive/safe), then Phase 2
-- ================================================================

-- ================================================================
-- PHASE 1: Add new shop_memberships-based policies
-- ================================================================

-- Pattern: (EXISTS (SELECT 1 FROM shop_memberships
--   WHERE user_id = auth.uid()
--   AND role IN ('admin', 'manager')
--   AND is_active = true))

-- 1. alert_configurations
CREATE POLICY "Alert configurations write by shop membership role" ON public.alert_configurations
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 2. alert_history
CREATE POLICY "Alert history write by shop membership role" ON public.alert_history
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 3. alert_recipients
CREATE POLICY "Alert recipients write by shop membership role" ON public.alert_recipients
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 4. alert_templates
CREATE POLICY "Alert templates write by shop membership role" ON public.alert_templates
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 5. app_settings (shop-scoped)
CREATE POLICY "App settings write by shop membership role" ON public.app_settings
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 6. cash_shifts
CREATE POLICY "Cash shifts write by shop membership role" ON public.cash_shifts
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 7. categories (shop-scoped)
CREATE POLICY "Categories write by shop membership role" ON public.categories
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 8. customers (shop-scoped delete)
CREATE POLICY "Customers delete by shop membership role" ON public.customers
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 9. customers (shop-scoped update)
CREATE POLICY "Customers update by shop membership role" ON public.customers
  FOR UPDATE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 10. discounts (shop-scoped)
CREATE POLICY "Discounts write by shop membership role" ON public.discounts
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 11. notification_service_config
CREATE POLICY "Notification service config write by shop membership role" ON public.notification_service_config
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 12. print_jobs (shop-scoped delete)
CREATE POLICY "Print jobs deletable by shop membership role" ON public.print_jobs
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 13. print_jobs (shop-scoped update)
CREATE POLICY "Print jobs updatable by shop membership role" ON public.print_jobs
  FOR UPDATE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 14. product_batches
CREATE POLICY "Product batches write by shop membership role" ON public.product_batches
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 15. products (shop-scoped delete)
CREATE POLICY "Products delete by shop membership role" ON public.products
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 16. products (shop-scoped update)
CREATE POLICY "Products update by shop membership role" ON public.products
  FOR UPDATE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 17. purchase_logs
CREATE POLICY "Purchase logs deletable by shop membership role" ON public.purchase_logs
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 18. sales (shop-scoped delete)
CREATE POLICY "Sales delete by shop membership role" ON public.sales
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 19. sales (shop-scoped update)
CREATE POLICY "Sales update by shop membership role" ON public.sales
  FOR UPDATE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 20. stock_items
CREATE POLICY "Stock items deletable by shop membership role" ON public.stock_items
  FOR DELETE USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 21. suppliers (shop-scoped)
CREATE POLICY "Suppliers write by shop membership role" ON public.suppliers
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role IN ('admin'::text, 'manager'::text)
      AND is_active = true))
  );

-- 22. shop_memberships (shop-scoped admin only)
CREATE POLICY "Shop memberships write by shop membership admin" ON public.shop_memberships
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (shop_id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'::text
      AND is_active = true))
  );

-- 23. shops (shop-scoped admin only)
CREATE POLICY "Shops write by shop membership admin" ON public.shops
  FOR ALL USING (
    (auth.role() = 'authenticated'::text)
    AND (id IN ( SELECT current_shop_ids() AS current_shop_ids))
    AND (EXISTS (SELECT 1 FROM public.shop_memberships
      WHERE user_id = auth.uid()
      AND role = 'admin'::text
      AND is_active = true))
  );

-- ================================================================
-- PHASE 2: Drop old users.role-based policies
-- ================================================================

-- alert tables
DROP POLICY IF EXISTS "Alert configurations write by shop admin/manager" ON public.alert_configurations;
DROP POLICY IF EXISTS "Alert history write by shop admin/manager" ON public.alert_history;
DROP POLICY IF EXISTS "Alert recipients write by shop admin/manager" ON public.alert_recipients;
DROP POLICY IF EXISTS "Alert templates write by shop admin/manager" ON public.alert_templates;

-- app_settings
DROP POLICY IF EXISTS "App settings write by admin/manager" ON public.app_settings;
DROP POLICY IF EXISTS "App settings write by shop admin/manager" ON public.app_settings;

-- cash_shifts
DROP POLICY IF EXISTS "Cash shifts write by shop admin/manager" ON public.cash_shifts;

-- categories
DROP POLICY IF EXISTS "Categories delete by admin/manager" ON public.categories;
DROP POLICY IF EXISTS "Categories update by admin/manager" ON public.categories;
DROP POLICY IF EXISTS "Categories write by shop admin/manager" ON public.categories;

-- customers
DROP POLICY IF EXISTS "Customers delete by admin/manager" ON public.customers;
DROP POLICY IF EXISTS "Customers delete by shop admin/manager" ON public.customers;
DROP POLICY IF EXISTS "Customers update by admin/manager" ON public.customers;
DROP POLICY IF EXISTS "Customers update by shop admin/manager" ON public.customers;

-- discounts
DROP POLICY IF EXISTS "Discounts delete by admin/manager" ON public.discounts;
DROP POLICY IF EXISTS "Discounts update by admin/manager" ON public.discounts;
DROP POLICY IF EXISTS "Discounts write by shop admin/manager" ON public.discounts;

-- notification_service_config
DROP POLICY IF EXISTS "Notification service config write by shop admin/manager" ON public.notification_service_config;

-- print_jobs
DROP POLICY IF EXISTS "Print jobs deletable by shop admin/manager" ON public.print_jobs;
DROP POLICY IF EXISTS "Print jobs updatable by shop admin/manager" ON public.print_jobs;

-- product_batches
DROP POLICY IF EXISTS "Product batches write by shop admin/manager" ON public.product_batches;

-- products
DROP POLICY IF EXISTS "Products delete by admin/manager" ON public.products;
DROP POLICY IF EXISTS "Products delete by shop admin/manager" ON public.products;
DROP POLICY IF EXISTS "Products update by admin/manager" ON public.products;
DROP POLICY IF EXISTS "Products update by shop admin/manager" ON public.products;

-- purchase_logs
DROP POLICY IF EXISTS "Purchase logs deletable by shop admin/manager" ON public.purchase_logs;

-- sales
DROP POLICY IF EXISTS "Sales delete by admin/manager" ON public.sales;
DROP POLICY IF EXISTS "Sales delete by shop admin/manager" ON public.sales;
DROP POLICY IF EXISTS "Sales update by admin/manager" ON public.sales;
DROP POLICY IF EXISTS "Sales update by shop admin/manager" ON public.sales;

-- shop_memberships (old non-scoped)
DROP POLICY IF EXISTS "Shop memberships write by global admin" ON public.shop_memberships;

-- shops (old non-scoped)
DROP POLICY IF EXISTS "Shops write by global admin" ON public.shops;

-- stock_items
DROP POLICY IF EXISTS "Stock items deletable by shop admin/manager" ON public.stock_items;

-- suppliers
DROP POLICY IF EXISTS "Suppliers delete by admin/manager" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers update by admin/manager" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers write by shop admin/manager" ON public.suppliers;

-- ================================================================
-- VERIFICATION: Run after migration to confirm no users.role policies remain
-- ================================================================
-- SELECT count(*) FROM pg_policies
-- WHERE schemaname = 'public' AND qual LIKE '%users.role%';
-- Should return 0

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
