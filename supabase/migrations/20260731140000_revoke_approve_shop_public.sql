-- Security hotfix: Revoke EXECUTE from PUBLIC role on approve_shop RPC
-- PostgreSQL grants EXECUTE to PUBLIC by default for functions.
-- This closes a privilege escalation vector where any authenticated user
-- could bypass the Edge Function and call approve_shop directly.
--
-- Original migration (20260730160000) only revoked from anon/authenticated.
-- Greptile audit #18 flagged this as HIGH severity (confidence 4/5).
-- Verified: Ko Htun tested REVOKE in Supabase Dashboard on 2026-07-31.
--
-- REVOKE is idempotent — safe to run multiple times.

REVOKE EXECUTE ON FUNCTION public.approve_shop(UUID, UUID) FROM PUBLIC;
