-- ================================================================
-- Migration: Onboarding Provision RPC — Phase 1
-- Date: 2026-07-30
-- Description:
--   Creates shop_invitations table for pending staff invitations
--   and provision_user RPC for atomic user provisioning.
--
--   VISION.md §6 (Onboarding Pipeline — Stage 1: INVITE)
--   VISION.md §17.3 (Edge Function Inventory: shop-invitations, user-provision)
--   Related: docs/specs/user-onboarding.md, docs/specs/technical-debt.md §6
--
--   Design decision: Provisioning happens AFTER auth.user creation.
--   The Edge Function calls auth.admin.createUser() first (trigger creates
--   public.users row), then calls provision_user() for the DB-level
--   provisioning (shop_memberships + audit trail).
-- ================================================================

-- ================================================================
-- 1. TABLE: shop_invitations
-- ================================================================

CREATE TABLE public.shop_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier'
        CHECK (role IN ('admin', 'manager', 'cashier')),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    invited_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shop_invitations IS 'Pending staff invitations. accepted_at = NULL means pending.';
COMMENT ON COLUMN public.shop_invitations.shop_id IS 'Shop this invitation belongs to (tenant isolation per VISION §18.2)';
COMMENT ON COLUMN public.shop_invitations.email IS 'Email of the invited user';
COMMENT ON COLUMN public.shop_invitations.role IS 'Role the invited user will receive on acceptance — source of truth for privilege';
COMMENT ON COLUMN public.shop_invitations.token IS 'Cryptographically random token shared via invite link';
COMMENT ON COLUMN public.shop_invitations.expires_at IS 'After this timestamp the invitation is no longer valid';
COMMENT ON COLUMN public.shop_invitations.accepted_at IS 'Set when the invitation is accepted. NULL = pending.';

-- ================================================================
-- 2. UPDATED_AT TRIGGER
-- ================================================================

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.shop_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- 3. RLS POLICIES
-- ================================================================

ALTER TABLE public.shop_invitations ENABLE ROW LEVEL SECURITY;

-- Invited user can see their own invitation (including token for acceptance)
-- Uses auth.uid() joined with public.users.email for reliable email matching
CREATE POLICY "invited_user_select_own" ON public.shop_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND email = shop_invitations.email
        )
    );

-- Admins/managers can see all invitations for their shop (management dashboard)
-- Uses EXISTS subquery instead of ANY(current_shop_ids()) because
-- current_shop_ids() returns SETOF, not array, and ANY() doesn't accept SETOF.
CREATE POLICY "admin_manager_select_all" ON public.shop_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shop_memberships
            WHERE user_id = auth.uid()
              AND shop_id = shop_invitations.shop_id
              AND role IN ('admin', 'manager')
              AND is_active = true
        )
    );

-- Shop admins/managers can create invitations (INSERT)
CREATE POLICY "admin_insert" ON public.shop_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shop_memberships
            WHERE user_id = auth.uid()
              AND shop_id = shop_invitations.shop_id
              AND role IN ('admin', 'manager')
              AND is_active = true
        )
    );

-- Shop admins/managers can update (revoke/cancel) invitations (UPDATE)
CREATE POLICY "admin_update" ON public.shop_invitations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.shop_memberships
            WHERE user_id = auth.uid()
              AND shop_id = shop_invitations.shop_id
              AND role IN ('admin', 'manager')
              AND is_active = true
        )
    );

-- No DELETE policy → implicit deny for client roles.
-- Only platform_admin (via service_role / Edge Function) can delete.

-- ================================================================
-- 4. INDEXES
-- ================================================================

-- Shop-level lookups
CREATE INDEX idx_shop_invitations_shop_id ON public.shop_invitations(shop_id);

-- Token lookups (invitation acceptance flow)
CREATE INDEX idx_shop_invitations_token ON public.shop_invitations(token);

-- Email lookups (checking if an email is already invited)
CREATE INDEX idx_shop_invitations_email ON public.shop_invitations(email);

-- Expiry queries (cleanup of stale invitations)
CREATE INDEX idx_shop_invitations_expires_at ON public.shop_invitations(expires_at);

-- Pending invitations by shop/email (check for duplicates)
CREATE INDEX idx_shop_invitations_pending ON public.shop_invitations(shop_id, email)
    WHERE accepted_at IS NULL;

-- ================================================================
-- 5. FUNCTION: provision_user
-- ================================================================
--
-- Atomic user provisioning inside a single DB transaction.
-- Called by Edge Functions after auth.admin.createUser() has already
-- created the auth.users row (which triggers handle_new_auth_user()
-- to create the public.users profile).
--
-- Parameters:
--   p_user_id    UUID   — The auth.users / public.users ID (already created by the auth trigger)
--   p_shop_id    UUID   — Target shop for the membership
--   p_invited_by UUID   — The admin/manager who initiated the provisioning
--   p_token      TEXT   — Invitation token (NULL for direct admin creation)
--   p_role       TEXT   — Role to assign (ONLY used when p_token IS NULL)
--
-- Returns: JSONB { success: bool, error?: string, user_id?: uuid }
--
-- Security: v_final_role is read from the invitation when a token is
-- present, preventing privilege escalation. The invitation's role is
-- the source of truth. Additionally, invitation email is bound to
-- p_user_id's email — a stolen token cannot be redeemed with a
-- different account (prevents token theft privilege escalation).
-- ================================================================

CREATE OR REPLACE FUNCTION public.provision_user(
    p_user_id UUID,
    p_shop_id UUID,
    p_invited_by UUID,
    p_token TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_invitation RECORD;
    v_final_role TEXT;
    v_user_email TEXT;
BEGIN
    -- ================================================================
    -- 1. Validate invitation token (if provided)
    -- ================================================================
    IF p_token IS NOT NULL THEN
        SELECT * INTO v_invitation
        FROM public.shop_invitations
        WHERE token = p_token
          AND accepted_at IS NULL
        FOR UPDATE;  -- Lock row to prevent double-accept (race condition)

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_TOKEN'
            );
        END IF;

        IF v_invitation.expires_at < now() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TOKEN_EXPIRED'
            );
        END IF;

        IF v_invitation.shop_id != p_shop_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TOKEN_SHOP_MISMATCH'
            );
        END IF;

        -- EMAIL BINDING: verify p_user_id's email matches the invitation email
        -- Prevents token theft — a stolen token cannot be used with a different account
        SELECT email INTO v_user_email FROM public.users WHERE id = p_user_id;

        IF v_user_email IS DISTINCT FROM v_invitation.email THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'EMAIL_MISMATCH',
                'expected', v_invitation.email,
                'provided_user_id', p_user_id
            );
        END IF;

        -- SOURCE OF TRUTH: role comes from invitation (prevents privilege escalation)
        v_final_role := v_invitation.role;
    ELSE
        -- Direct admin/owner creation: role comes from parameter
        IF p_role IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'ROLE_REQUIRED'
            );
        END IF;
        v_final_role := p_role;
    END IF;

    -- ================================================================
    -- 2. Validate final role
    -- ================================================================
    IF v_final_role NOT IN ('admin', 'manager', 'cashier') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_ROLE'
        );
    END IF;

    -- ================================================================
    -- 3. Atomic provisioning (BEGIN/COMMIT implicit in single RPC)
    -- ================================================================

    -- 3a. Guard: check for existing membership (direct path only;
    --    token path is protected by FOR UPDATE lock on unaccepted invite)
    IF EXISTS (
        SELECT 1 FROM public.shop_memberships
        WHERE user_id = p_user_id AND shop_id = p_shop_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ALREADY_MEMBER',
            'user_id', p_user_id,
            'shop_id', p_shop_id
        );
    END IF;

    -- 3b. Insert shop_memberships (with role from invitation when token present)
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (p_user_id, p_shop_id, v_final_role, true);

    -- 3c. Mark invitation as accepted (if token flow)
    IF p_token IS NOT NULL THEN
        UPDATE public.shop_invitations
        SET accepted_at = now()
        WHERE token = p_token;
    END IF;

    -- 3d. Log to audit_logs (atomic accountability)
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_invited_by,
        'provision_user',
        'user',
        p_user_id,
        p_shop_id,
        jsonb_build_object(
            'role', v_final_role,
            'method', CASE WHEN p_token IS NOT NULL THEN 'invitation' ELSE 'direct' END
        )
    );

    -- ================================================================
    -- 4. Return success
    -- ================================================================
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execution from client roles (platform admin only via Edge Functions)
REVOKE EXECUTE ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT)
FROM anon, authenticated;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Verify shop_invitations table exists:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'shop_invitations';
-- Expected: 1 row

-- Verify RLS is enabled:
-- SELECT relname, relrowsecurity FROM pg_class
-- WHERE relname = 'shop_invitations';
-- Expected: true

-- Verify function exists:
-- SELECT proname FROM pg_proc WHERE proname = 'provision_user';
-- Expected: 1 row

-- Verify REVOKE:
-- SELECT proacl FROM pg_proc WHERE proname = 'provision_user';
-- Expected: no 'anon' or 'authenticated' entries