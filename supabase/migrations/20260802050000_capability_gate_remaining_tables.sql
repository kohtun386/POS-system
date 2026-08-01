-- ================================================================
-- Capability-gate remaining 8 tables (Migration B)
-- ================================================================
-- Adds has_capability() to every existing policy on these tables.
-- Preserves all existing role-gate logic — only ADDs capability.
--
-- print_jobs INSERT: no role-gate added (cashiers trigger prints
-- at checkout — this is correct per product owner confirmation).
-- ================================================================

-- ================================================================
-- 1. print_jobs (capability: 'printer_integration')
-- ================================================================

-- SELECT
DROP POLICY IF EXISTS "Print jobs viewable by shop members" ON public.print_jobs;
CREATE POLICY "Print jobs viewable by shop members" ON public.print_jobs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'printer_integration')
  );

-- INSERT (no role-gate — cashiers trigger prints at checkout)
DROP POLICY IF EXISTS "Print jobs insertable by shop members" ON public.print_jobs;
CREATE POLICY "Print jobs insertable by shop members" ON public.print_jobs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'printer_integration')
  );

-- UPDATE (preserve admin/manager gate)
DROP POLICY IF EXISTS "Print jobs updatable by shop membership role" ON public.print_jobs;
CREATE POLICY "Print jobs updatable by shop membership role" ON public.print_jobs
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'printer_integration')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = print_jobs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- DELETE (preserve admin/manager gate)
DROP POLICY IF EXISTS "Print jobs deletable by shop membership role" ON public.print_jobs;
CREATE POLICY "Print jobs deletable by shop membership role" ON public.print_jobs
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'printer_integration')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = print_jobs.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 2. suppliers (capability: 'stock_overview')
-- ================================================================

-- SELECT
DROP POLICY IF EXISTS "Suppliers viewable by shop members" ON public.suppliers;
CREATE POLICY "Suppliers viewable by shop members" ON public.suppliers
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
  );

-- INSERT (preserve admin/manager gate from with_check)
DROP POLICY IF EXISTS "Suppliers insert by shop membership role" ON public.suppliers;
CREATE POLICY "Suppliers insert by shop membership role" ON public.suppliers
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = suppliers.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ALL (preserve admin/manager gate)
DROP POLICY IF EXISTS "Suppliers write by shop membership role" ON public.suppliers;
CREATE POLICY "Suppliers write by shop membership role" ON public.suppliers
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'stock_overview')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = suppliers.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 3. alert_configurations (capability: 'low_stock_alerts')
-- ================================================================

DROP POLICY IF EXISTS "Alert configurations viewable by shop members" ON public.alert_configurations;
CREATE POLICY "Alert configurations viewable by shop members" ON public.alert_configurations
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
  );

DROP POLICY IF EXISTS "Alert configurations write by shop membership role" ON public.alert_configurations;
CREATE POLICY "Alert configurations write by shop membership role" ON public.alert_configurations
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = alert_configurations.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 4. alert_history (capability: 'low_stock_alerts')
-- ================================================================

DROP POLICY IF EXISTS "Alert history viewable by shop members" ON public.alert_history;
CREATE POLICY "Alert history viewable by shop members" ON public.alert_history
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
  );

DROP POLICY IF EXISTS "Alert history write by shop membership role" ON public.alert_history;
CREATE POLICY "Alert history write by shop membership role" ON public.alert_history
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = alert_history.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 5. alert_recipients (capability: 'low_stock_alerts')
-- ================================================================

DROP POLICY IF EXISTS "Alert recipients viewable by shop members" ON public.alert_recipients;
CREATE POLICY "Alert recipients viewable by shop members" ON public.alert_recipients
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
  );

DROP POLICY IF EXISTS "Alert recipients write by shop membership role" ON public.alert_recipients;
CREATE POLICY "Alert recipients write by shop membership role" ON public.alert_recipients
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = alert_recipients.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 6. alert_templates (capability: 'low_stock_alerts')
-- ================================================================

DROP POLICY IF EXISTS "Alert templates viewable by shop members" ON public.alert_templates;
CREATE POLICY "Alert templates viewable by shop members" ON public.alert_templates
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
  );

DROP POLICY IF EXISTS "Alert templates write by shop membership role" ON public.alert_templates;
CREATE POLICY "Alert templates write by shop membership role" ON public.alert_templates
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = alert_templates.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 7. cash_shifts (capability: 'cash_drawer')
-- ================================================================

DROP POLICY IF EXISTS "Cash shifts viewable by shop members" ON public.cash_shifts;
CREATE POLICY "Cash shifts viewable by shop members" ON public.cash_shifts
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'cash_drawer')
  );

DROP POLICY IF EXISTS "Cash shifts write by shop membership role" ON public.cash_shifts;
CREATE POLICY "Cash shifts write by shop membership role" ON public.cash_shifts
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'cash_drawer')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = cash_shifts.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );

-- ================================================================
-- 8. notification_service_config (capability: 'low_stock_alerts')
-- ================================================================

DROP POLICY IF EXISTS "Notification service config viewable by shop members" ON public.notification_service_config;
CREATE POLICY "Notification service config viewable by shop members" ON public.notification_service_config
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
  );

DROP POLICY IF EXISTS "Notification service config write by shop membership role" ON public.notification_service_config;
CREATE POLICY "Notification service config write by shop membership role" ON public.notification_service_config
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT current_shop_ids())
    AND public.has_capability(shop_id, 'low_stock_alerts')
    AND EXISTS (
      SELECT 1 FROM shop_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.shop_id = notification_service_config.shop_id
        AND sm.role IN ('admin', 'manager')
        AND sm.is_active = true
    )
  );
