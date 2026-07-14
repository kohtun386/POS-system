-- ================================================================
-- check_inventory_alerts RPC
-- Returns products where stock <= min_stock (low stock alerts)
-- ================================================================

CREATE OR REPLACE FUNCTION public.check_inventory_alerts()
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  current_stock INT,
  min_stock INT,
  threshold_value INT,
  alert_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.stock AS current_stock,
    p.min_stock AS min_stock,
    p.min_stock AS threshold_value,
    CASE
      WHEN p.stock = 0 THEN 'out_of_stock'
      WHEN p.stock <= p.min_stock THEN 'low_stock'
      ELSE 'normal'
    END AS alert_type
  FROM public.products p
  WHERE p.track_inventory = true
    AND p.stock <= p.min_stock
    AND p.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_inventory_alerts() TO authenticated;
