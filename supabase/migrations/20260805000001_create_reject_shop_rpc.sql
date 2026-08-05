-- ================================================================
-- Migration: reject_shop Atomic RPC
-- Date: 2026-08-05
-- Description:
--   Creates reject_shop() RPC to replace 2 sequential UPDATE
--   calls (shop_memberships, users) in the platform-admin-
--   reject-shop Edge Function with a single atomic transaction.
--
--   Mirrors approve_shop() pattern from
--   migration 20260730160000_approve_shop_atomic_rpc.sql
-- ================================================================

-- ================================================================
-- 1. FUNCTION: reject_shop
-- ================================================================
--
-- Atomically rejects a pending shop inside a single DB transaction.
-- Called by the platform-admin-reject-shop Edge Function with
-- service_role context (not through RLS).
--
-- Parameters:
--   p_shop_id      UUID  — The shop to reject
--   p_approver_id  UUID  — The platform_admin rejecting the shop
--   p_reason       TEXT  — Optional rejection reason
--
-- Returns: JSONB { success: bool, error?: string, shop_id?: uuid,
--                   shop_name?: text, owner_id?: uuid }
--
-- Security: Validates caller is platform_admin (defense-in-depth;
--           edge function also verifies via JWT). Runs SECURITY
--           DEFINER so the reads inside the function bypass RLS.
-- ================================================================

CREATE OR REPLACE FUNCTION public.reject_shop(
    p_shop_id UUID,
    p_approver_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_shop RECORD;
    v_membership RECORD;
BEGIN
    -- ================================================================
    -- 1. Validate shop exists and is not already active
    -- ================================================================
    SELECT id, name, owner_id, is_active INTO v_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND');
    END IF;

    IF v_shop.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHOP_ALREADY_ACTIVE');
    END IF;

    -- ================================================================
    -- 2. Validate approver is platform_admin
    -- ================================================================
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_approver_id AND role = 'platform_admin'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    -- ================================================================
    -- 3. Get the admin membership (owner) for this shop
    -- ================================================================
    SELECT id, user_id INTO v_membership
    FROM public.shop_memberships
    WHERE shop_id = p_shop_id AND role = 'admin'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ADMIN_MEMBERSHIP');
    END IF;

    -- ================================================================
    -- 4. Atomic updates (BEGIN/COMMIT implicit in single RPC)
    -- ================================================================

    -- 4a. Deactivate all memberships for this shop
    UPDATE public.shop_memberships
    SET is_active = false, updated_at = now()
    WHERE shop_id = p_shop_id;

    -- 4b. Deactivate the owner's user profile
    UPDATE public.users
    SET active = false, updated_at = now()
    WHERE id = v_membership.user_id;

    -- ================================================================
    -- 5. Audit log (atomic accountability)
    -- ================================================================
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_approver_id,
        'reject_shop',
        'shop',
        p_shop_id,
        p_shop_id,
        jsonb_build_object(
            'shop_name', v_shop.name,
            'owner_id', v_membership.user_id,
            'reason', p_reason
        )
    );

    -- ================================================================
    -- 6. Return success
    -- ================================================================
    RETURN jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'shop_name', v_shop.name,
        'owner_id', v_membership.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execution from client roles (platform admin only via Edge Functions)
REVOKE EXECUTE ON FUNCTION public.reject_shop(UUID, UUID, TEXT)
FROM anon, authenticated;
