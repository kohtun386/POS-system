-- ================================================================
-- Migration: Harden users RLS policies — close privilege escalation
-- Date: 2026-07-31
-- Description:
--   G1 (P0): users INSERT policy allowed ANY authenticated user to
--     insert a public.users row with role='platform_admin'/'admin',
--     active=true, and any shop_id — bypassing the pending-approval
--     flow and staff_accounts tier limits. Pin the INSERT row to
--     the caller: id = auth.uid().
--
--   G2: users UPDATE policy had with_check = NULL. A cashier who
--     matched USING (own row) could set role='admin' on their own
--     row — self privilege escalation. Add WITH CHECK that forbids
--     changing role / active / shop_id on the client path, while
--     preserving legitimate admin management of other users (admin
--     branch in USING and WITH CHECK).
--
--   Legit creation paths bypass RLS by design (unaffected):
--     - handle_new_auth_user() trigger  (SECURITY DEFINER)
--     - staff-create Edge Function      (SERVICE_ROLE_KEY + provision_user)
--     - provision_user RPC              (SECURITY DEFINER)
--
--   Legit admin UPDATE flows preserved (UserModal.tsx, UserManager.tsx):
--     admins may update any row including role/active via the admin
--     branch; the DB CHECK on role limits values; a user can never
--     promote themself because the self branch pins role/active/shop_id
--     to their existing values.
--
--   VISION.md §4.3 (platform_admin bypasses RLS via Edge Functions only),
--   §6.3 (Onboarding requires manual approval), §18.2 (multi-tenant RLS).
-- ================================================================

-- ================================================================
-- 1. G1: Pin INSERT row to the caller
-- ================================================================
-- Before: with_check = auth.role() = 'authenticated' only — any
-- authenticated user could self-register as platform_admin/admin.
DROP POLICY IF EXISTS "Users insert by authenticated" ON public.users;

CREATE POLICY "Users insert self only" ON public.users
    FOR INSERT TO public
    WITH CHECK (
        auth.role() = 'authenticated'
        AND id = auth.uid()
    );

-- ================================================================
-- 2. G2: Harden UPDATE — block client-side self privilege escalation
-- ================================================================
-- Before: USING only, with_check = NULL. Recreate with:
--   USING    — unchanged semantics (self OR users.role='admin'),
--              preserving the live policy and App.tsx userRole gating.
--   WITH CHECK — self updates may NOT change role / active / shop_id;
--              admins may manage OTHER users' rows (role/active), but
--              may not change their own row (id <> auth.uid()), so an
--              admin cannot self-promote to 'platform_admin' via the
--              client API.
-- The self branch compares against the row's PRE-update values, so a
-- cashier changing their own role to 'admin' violates the CHECK and is
-- rejected. This also closes the live platform_admin-with-membership
-- hole: users.role='platform_admin' does not satisfy the admin branch,
-- so such accounts cannot edit any user's role/active through the REST
-- API (they operate via service_role Edge Functions per VISION §4.3).
DROP POLICY IF EXISTS "Users update self or admin" ON public.users;

CREATE POLICY "Users update self or admin" ON public.users
    FOR UPDATE TO public
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = id
            OR EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND u.role = 'admin'
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (
            -- Admin branch: manage OTHER users (role/active allowed).
            -- id <> auth.uid() blocks self role/active changes, so an
            -- admin cannot promote themself to platform_admin.
            (
                EXISTS (
                    SELECT 1
                    FROM public.users u
                    WHERE u.id = auth.uid()
                      AND u.role = 'admin'
                )
                AND id <> auth.uid()
            )
            OR (
                -- Self branch: only benign profile edits; role, active,
                -- and shop_id must remain unchanged (no self-escalation).
                auth.uid() = id
                AND role = (SELECT role FROM public.users WHERE id = auth.uid())
                AND active = (SELECT active FROM public.users WHERE id = auth.uid())
                AND shop_id = (SELECT shop_id FROM public.users WHERE id = auth.uid())
            )
        )
    );

-- ================================================================
-- VERIFICATION
-- ================================================================
-- Expected: INSERT policy "Users insert self only" with_check pins id.
--   SELECT policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'users';
--
-- Expected: UPDATE policy "Users update self or admin" now has
-- non-null with_check (no privilege escalation via client API).
--
-- Verify as cashier: PATCH /rest/v1/users?id=eq.<self> {"role":"admin"}
--   must return 403. Admin can still edit role/active via app.
