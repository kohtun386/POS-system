-- ================================================================
-- Migration: Revoke provision_user EXECUTE from anon/authenticated
-- Date: 2026-07-31
-- Description:
--   20260731170000 revoked provision_user from PUBLIC, but this schema
--   has an ALTER DEFAULT PRIVILEGES (functions) that grants
--   anon/authenticated EXECUTE on every new function. The freshly
--   CREATEd 6-arg provision_user inherited those default grants, so
--   live proacl is {postgres, anon, authenticated, service_role}.
--
--   SECURITY: an authenticated user could call provision_user to set
--   arbitrary users.role/active/shop_id. Close it by explicitly
--   revoking from anon/authenticated, leaving only service_role
--   (Edge Function admin client) + owner (postgres).
-- ================================================================

REVOKE ALL ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;

-- ================================================================
-- VERIFICATION (after apply):
--   SELECT proacl FROM pg_proc WHERE proname = 'provision_user';
--   Expected: {postgres=X/postgres, service_role=X/postgres}
--   SELECT has_function_privilege('anon','public.provision_user(uuid,uuid,uuid,text,text,boolean)','EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated', '...', 'EXECUTE'); -- false
--   SELECT has_function_privilege('service_role', '...', 'EXECUTE');  -- true
-- ================================================================
