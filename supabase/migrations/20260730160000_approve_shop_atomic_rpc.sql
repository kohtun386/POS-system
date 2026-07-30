-- ================================================================
-- Migration: approve_shop Atomic RPC — Phase 2
-- Date: 2026-07-30
-- Description:
--   Creates approve_shop() RPC to replace 3 sequential UPDATE
--   calls (shops, shop_memberships, users) in the platform-admin-
--   approve-shop Edge Function with a single atomic transaction.
--
--   Related: docs/specs/technical-debt.md §6 (RESOLVED)
--   Pattern: follows provision_user() RPC from
--            migration 20260730124100_onboarding_provision_rpc.sql
-- ================================================================

-- ================================================================
-- 1. FUNCTION: approve_shop
-- ================================================================
--
-- Atomically approves a pending shop inside a single DB transaction.
-- Called by the platform-admin-approve-shop Edge Function with
-- service_role context (not through RLS).
--
-- Parameters:
--   p_shop_id      UUID  — The shop to approve
--   p_approver_id  UUID  — The platform_admin approving the shop
--
-- Returns: JSONB { success: bool, error?: string, shop_id?: uuid,
--                   shop_name?: text, owner_id?: uuid }
--
-- Security: Validates caller is platform_admin (defense-in-depth;
--           edge function also verifies via JWT). Runs SECURITY
--           DEFINER so the reads inside the function bypass RLS.
-- ================================================================

CREATE OR REPLACE FUNCTION public.approve_shop(
    p_shop_id UUID,
    p_approver_id UUID
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
    SELECT id, name, is_active INTO v_shop
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

    -- 4a. Activate the shop
    UPDATE public.shops
    SET is_active = true, subscription_tier = 'free', updated_at = now()
    WHERE id = p_shop_id;

    -- 4b. Activate the admin's membership
    UPDATE public.shop_memberships
    SET is_active = true, updated_at = now()
    WHERE id = v_membership.id;

    -- 4c. Activate the owner's user profile
    UPDATE public.users
    SET active = true, updated_at = now()
    WHERE id = v_membership.user_id;

    -- ================================================================
    -- 5. Audit log (atomic accountability)
    -- ================================================================
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_approver_id,
        'approve_shop',
        'shop',
        p_shop_id,
        p_shop_id,
        jsonb_build_object(
            'shop_name', v_shop.name,
            'owner_id', v_membership.user_id
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
REVOKE EXECUTE ON FUNCTION public.approve_shop(UUID, UUID)
FROM anon, authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Verify function exists:
-- SELECT proname FROM pg_proc WHERE proname = 'approve_shop';
-- Expected: 1 row

-- Verify REVOKE:
-- SELECT proacl::text FROM pg_proc WHERE proname = 'approve_shop';
-- Expected: no 'anon' or 'authenticated' entries in the ACL

-- Test happy path (approve a specific shop):
-- SELECT approve_shop('<shop-uuid>', '<platform-admin-uuid>');
-- Expected: {"success": true, "shop_id": "...", "shop_name": "...", "owner_id": "..."}

-- Test already-active shop:
-- SELECT approve_shop('<active-shop-uuid>', '<platform-admin-uuid>');
-- Expected: {"success": false, "error": "SHOP_ALREADY_ACTIVE"}

-- Test unauthorized user:
-- SELECT approve_shop('<shop-uuid>', '<non-admin-uuid>');
-- Expected: {"success": false, "error": "UNAUTHORIZED"}

-- Test nonexistent shop:
-- SELECT approve_shop('00000000-0000-0000-0000-000000000000', '<platform-admin-uuid>');
-- Expected: {"success": false, "error": "SHOP_NOT_FOUND"}
