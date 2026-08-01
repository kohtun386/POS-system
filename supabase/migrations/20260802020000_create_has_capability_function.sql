-- ================================================================
-- has_capability(p_shop_id, p_capability_key) → boolean
-- ================================================================
-- Thin wrapper over resolve_capabilities() for use in RLS policies.
--
-- resolve_capabilities() RETURNS TABLE(capability text) — a set of
-- rows, not text[]. has_capability() converts that to a boolean
-- existence check.
--
-- SECURITY DEFINER is required because:
--   1. RLS policies execute as the querying user (auth.uid()),
--      but resolve_capabilities() needs to read shops + feature_definitions
--      which are also RLS-protected.
--   2. Keeping this SECURITY DEFINER ensures the inner query runs
--      with owner privileges, bypassing the caller's RLS context.
--
-- EXECUTE granted to 'authenticated' (NOT revoked) because:
--   RLS policies run as the authenticated user, not as a privileged
--   role. Unlike provision_user/approve_shop which are called from
--   Edge Functions (service_role), this function MUST be callable
--   from the user's own RLS evaluation context.
-- ================================================================

CREATE OR REPLACE FUNCTION public.has_capability(
  p_shop_id uuid,
  p_capability_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.resolve_capabilities(p_shop_id) rc
    WHERE rc.capability = p_capability_key
  );
$function$;

-- Grant EXECUTE to authenticated so RLS policies can call this function.
-- This is intentional and differs from provision_user/approve_shop
-- which are revoked from authenticated/anon (those run via Edge Functions
-- with service_role, not from user-level RLS context).
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated;
