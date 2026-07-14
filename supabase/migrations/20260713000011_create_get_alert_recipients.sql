-- ================================================================
-- get_alert_recipients RPC
-- Returns users with admin/manager role for the shop
-- (the standard recipients for inventory alerts)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_alert_recipients(alert_type_param TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    ''::TEXT AS phone,
    u.role
  FROM users u
  WHERE u.role IN ('admin', 'manager')
    AND u.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alert_recipients(TEXT) TO authenticated;
