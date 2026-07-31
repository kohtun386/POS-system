-- ================================================================
-- Migration: FIX 42P17 recursion in users UPDATE policy (HOTFIX)
-- Date: 2026-07-31
-- Description:
--   The previous migration (20260731150000_harden_users_rls_policies.sql)
--   introduced a WITH CHECK on the users UPDATE policy that referenced
--   public.users directly via subqueries. PostgreSQL re-applies RLS to
--   self-table subqueries inside an UPDATE policy, producing:
--       ERROR 42P17: infinite recursion detected in policy for relation "users"
--   This broke ALL client-side users UPDATEs — including the legitimate
--   admin flows (UserModal.tsx role/active edit, UserManager.tsx toggle).
--
--   Fix: route the privilege + immutable-field checks through SECURITY
--   DEFINER helper functions. SECURITY DEFINER functions run as the
--   function owner and BYPASS RLS entirely, so referencing public.users
--   inside them cannot recurse. They are self-scoped to auth.uid(), so
--   they never read another tenant's rows.
--
--   Semantics preserved from 20260731150000 (G1/G2/kokoe closure):
--     - INSERT pinned to id = auth.uid()            (unchanged)
--     - UPDATE: admin (users.role='admin') may manage OTHER users'
--       rows (id <> auth.uid()), may NOT change their own row;
--       self may edit own profile but role/active/shop_id pinned.
--
--   VISION.md §4.3, §6.3, §18.2. Migration-safety: RLS recursion checklist.
-- ================================================================

-- ================================================================
-- 1. SECURITY DEFINER helpers — recursion-proof self reads
-- ================================================================
-- Each returns ONLY the caller's own public.users row value, looked up
-- by auth.uid(). SECURITY DEFINER + SET search_path='' per project
-- convention. Because they execute as the owner, RLS on users does not
-- re-apply inside them, breaking the recursion loop.

CREATE OR REPLACE FUNCTION public.users_get_own_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.users_get_own_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT active FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.users_get_own_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT shop_id FROM public.users WHERE id = auth.uid()
$$;

-- The project convention (GRANT EXECUTE ON ALL FUNCTIONS is not
-- retroactive for new functions) requires explicit per-function grants.
-- These MUST be callable by authenticated because RLS policies invoke
-- them. They are self-scoped read-only helpers — safe to grant.
GRANT EXECUTE ON FUNCTION public.users_get_own_role()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_get_own_active()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_get_own_shop_id()  TO authenticated;

-- ================================================================
-- 2. Recreate users UPDATE policy — no self-table subquery
-- ================================================================
DROP POLICY IF EXISTS "Users update self or admin" ON public.users;

CREATE POLICY "Users update self or admin" ON public.users
    FOR UPDATE TO public
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = id
            OR public.users_get_own_role() = 'admin'
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            -- Admin branch: manage OTHER users' rows only (id <> auth.uid()).
            -- blocks admin self-promotion to platform_admin via client API.
            (
                public.users_get_own_role() = 'admin'
                AND id <> auth.uid()
            )
            OR (
                -- Self branch: benign profile edits only. role, active,
                -- shop_id are pinned to the caller's PRE-update values
                -- (SECURITY DEFINER read of own row), so a cashier/admin
                -- cannot self-escalate role/active via the REST API.
                auth.uid() = id
                AND role = public.users_get_own_role()
                AND active = public.users_get_own_active()
                AND shop_id = public.users_get_own_shop_id()
            )
        )
    );

-- ================================================================
-- VERIFICATION (run after push)
-- ================================================================
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename='users' ORDER BY cmd;
--
-- 1. Cashier self-PATCH role -> 403 (no escalation)
-- 2. Admin edits OTHER user's role/active -> allowed (no recursion)
-- 3. Admin self-PATCH role -> 403 (id <> auth.uid())
-- 4. No 42P17 on any users UPDATE
