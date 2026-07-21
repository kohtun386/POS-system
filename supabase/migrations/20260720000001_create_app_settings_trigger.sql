-- Migration: Backfill missing app_settings rows and create trigger for new shops
-- This migration ensures every shop has an associated app_settings record.

-- 1. Backfill existing shops without app_settings
INSERT INTO public.app_settings (shop_id, store_name, interface_mode, theme, auto_backup, invoice_prefix, invoice_counter)
SELECT s.id,
       s.name,
       'touch' AS interface_mode,
       'light' AS theme,
       true AS auto_backup,
       COALESCE(s.invoice_prefix, 'INV') AS invoice_prefix,
       COALESCE(s.invoice_counter, 1000) AS invoice_counter
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings a WHERE a.shop_id = s.id
);

-- 2. Create trigger to auto-create app_settings for newly inserted shops
CREATE OR REPLACE FUNCTION public.handle_new_shop_app_settings()
RETURNS TRIGGER
SET search_path = ''
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.app_settings (
    shop_id,
    store_name,
    interface_mode,
    theme,
    auto_backup,
    invoice_prefix,
    invoice_counter
  ) VALUES (
    NEW.id,
    NEW.name,
    'touch',
    'light',
    true,
    COALESCE(NEW.invoice_prefix, 'INV'),
    COALESCE(NEW.invoice_counter, 1000)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_default_app_settings
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_shop_app_settings();
