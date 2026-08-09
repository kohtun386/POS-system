-- ================================================================
-- Migration: Remove PUBLIC EXECUTE from platform admin RPCs
-- Date: 2026-08-09
-- Description:
--   Platform-admin RPCs must only be callable by the server-side
--   Edge Function layer via service_role. This migration removes any
--   implicit PUBLIC EXECUTE privilege left behind after creating
--   admin-only functions such as cleanup_test_data() and reject_shop().
--
--   Public/anonymous access is forbidden for these functions because
--   they expose privileged operations, and the project design requires
--   platform admin actions to be invoked only through Edge Functions
--   using the service_role key.
--
--   VISION.md §4.3 (platform_admin bypasses RLS via service_role EFs
--   only), §17 (Edge Functions).
-- ================================================================

-- Remove the implicit PUBLIC grant. This is the critical fix.
REVOKE EXECUTE ON FUNCTION public.cleanup_test_data(boolean, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_shop(uuid, uuid, text) FROM PUBLIC;

-- If the database also has explicit client-role grants, remove them too.
REVOKE EXECUTE ON FUNCTION public.cleanup_test_data(boolean, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_shop(uuid, uuid, text) FROM anon, authenticated;

-- Keep the server-side admin path working via Edge Functions.
GRANT EXECUTE ON FUNCTION public.cleanup_test_data(boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_shop(uuid, uuid, text) TO service_role;

-- ================================================================
-- VERIFICATION (run after apply)
-- ================================================================
-- SELECT proname, proacl
-- FROM pg_proc
-- WHERE proname IN ('cleanup_test_data', 'reject_shop', 'approve_shop');
--
-- Expected pattern:
--   {postgres=X/postgres,service_role=X/postgres}
--   with NO PUBLIC entry (=X/...)
--
-- Anonymous/authenticated cannot execute:
--   SELECT has_function_privilege('anon', 'public.cleanup_test_data(bool,uuid)', 'EXECUTE');
--   SELECT has_function_privilege('authenticated', 'public.cleanup_test_data(bool,uuid)', 'EXECUTE');
--   SELECT has_function_privilege('authenticated', 'public.reject_shop(uuid,uuid,text)', 'EXECUTE');
-- Expected: false
--
-- service_role still can execute:
--   SELECT has_function_privilege('service_role', 'public.cleanup_test_data(bool,uuid)', 'EXECUTE');
--   SELECT has_function_privilege('service_role', 'public.reject_shop(uuid,uuid,text)', 'EXECUTE');
-- Expected: true
