-- ================================================================
-- Migration: Constrain users self-INSERT to unprivileged role
-- Date: 2026-07-31
-- Description:
--   Code-review finding on 20260731150000: the INSERT policy
--   "Users insert self only" pins id = auth.uid() but leaves the
--   caller-controlled `role` unconstrained. An authenticated caller
--   who has no public.users row (e.g. a signup whose trigger-created
--   profile is missing) could INSERT their own row with
--   role = 'admin', which then satisfies users_get_own_role() = 'admin'
--   and unlocks the UPDATE admin branch (edit other users' role/active/
--   shop_id).
--
--   No legitimate flow inserts a public.users row via the client API:
--     - signup: handle_new_auth_user() trigger (SECURITY DEFINER)
--     - staff-create Edge Function (service_role)
--     - provision_user RPC (SECURITY DEFINER)
--   The signup flow explicitly fetches the trigger-created profile
--   "instead of inserting" (AuthContext.tsx signUp). So tightening the
--   client INSERT is safe and closes the escalation.
--
--   Fix: on the client path, a self-inserted row is an unprivileged
--   profile awaiting approval — pin role = 'cashier' and active = false,
--   mirroring the UPDATE self-branch's immutability.
--
--   VISION.md §4.3, §6.3 (onboarding requires manual approval).
-- ================================================================

DROP POLICY IF EXISTS "Users insert self only" ON public.users;

CREATE POLICY "Users insert self only" ON public.users
    FOR INSERT TO public
    WITH CHECK (
        auth.role() = 'authenticated'
        AND id = auth.uid()
        -- Self-inserted profiles are unprivileged and await approval.
        -- role='cashier' prevents unlocking the UPDATE admin branch;
        -- active=false routes through the pending-approval flow.
        AND role = 'cashier'
        AND active = false
    );

-- ================================================================
-- VERIFICATION
-- ================================================================
-- 1. INSERT own row with role='admin'     -> BLOCKED (42501)
-- 2. INSERT own row with role='cashier',
--    active=false                         -> ALLOWED
-- 3. trigger / staff-create / provision_user flows unaffected
--    (all bypass RLS / SECURITY DEFINER).
