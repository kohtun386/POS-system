-- ================================================================
-- Restrict SELECT on notification_service_config to active admin/manager.
-- Fixes RLS permissive-OR leak: any shop member with low_stock_alerts
-- capability could read config_data (plaintext provider secrets).
-- Mirrors the existing ALL-policy role check (migration 20260802050000).
-- ================================================================

DROP POLICY IF EXISTS "Notification service config viewable by shop members" ON public.notification_service_config;
CREATE POLICY "Notification service config viewable by shop members" ON public.notification_service_config
  FOR SELECT USING (
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
