-- ================================================================
-- Migration: provision_user — preserve existing user's primary shop
-- Date: 2026-07-31
-- Description:
--   pr-reviewer MAJOR finding on 20260731170000: the users upsert
--   (3a) unconditionally overwrote role/active/shop_id via
--   ON CONFLICT (id) DO UPDATE. In the TOKEN flow, an existing user
--   who already has an active membership in a DIFFERENT shop (e.g. a
--   self-registered owner of shop A) accepting an invitation to shop
--   B would get:
--     - users.role silently demoted admin -> cashier
--       (locks them out of the UPDATE-policy admin branch for shop A,
--        which gates on users_get_own_role()='admin' — 20260731151000)
--     - users.shop_id repointed A -> B (primary-shop switch)
--
--   Fix: only promote role/active/shop_id when the user has NO active
--   membership in a different shop (i.e. they are not an existing
--   primary user). A fresh dormant profile (invitation Branch B) has
--   zero memberships, so it is still promoted. A user already primary
--   somewhere keeps their identity; the invitation still adds them as
--   a member of the new shop via 3b.
-- ================================================================

CREATE OR REPLACE FUNCTION public.provision_user(
    p_user_id UUID,
    p_shop_id UUID,
    p_invited_by UUID,
    p_token TEXT DEFAULT NULL,
    p_target_role TEXT DEFAULT NULL,
    p_active BOOLEAN DEFAULT true
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_invitation RECORD;
    v_final_role TEXT;
    v_user_email TEXT;
    v_phantom_shop_id UUID;
    v_promote_profile BOOLEAN;
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
        -- (prevents token theft). Read from auth.users (the authoritative
        -- account email) — the public.users profile may not exist yet if the
        -- trigger skipped the insert; the upsert below self-heals it.
        SELECT au.email INTO v_user_email
        FROM auth.users au WHERE au.id = p_user_id;

        IF v_user_email IS DISTINCT FROM v_invitation.email THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'EMAIL_MISMATCH',
                'expected', v_invitation.email,
                'provided_user_id', p_user_id
            );
        END IF;

        -- SOURCE OF TRUTH: role comes from invitation (prevents escalation)
        v_final_role := v_invitation.role;
    ELSE
        -- Direct admin/owner creation: role comes from parameter
        IF p_target_role IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'ROLE_REQUIRED'
            );
        END IF;
        v_final_role := p_target_role;
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
    -- 3. Atomic provisioning (single RPC = single transaction)
    -- ================================================================

    -- Does the user already have an ACTIVE membership in a DIFFERENT
    -- shop? If so, they are a primary user elsewhere (owner/manager) —
    -- their users.role / users.shop_id is their primary identity and
    -- must NOT be overwritten by this invitation. The membership upsert
    -- (3b) still adds them to the new shop.
    v_promote_profile := NOT EXISTS (
        SELECT 1 FROM public.shop_memberships
        WHERE user_id = p_user_id
          AND shop_id <> p_shop_id
          AND is_active = true
    );

    -- 3a. Upsert public.users row — this is where staff authorization now
    --     happens. Handles both the trigger-created dormant profile
    --     (DO UPDATE promotes role/active/shop_id) and the edge case where
    --     the trigger skipped the insert (INSERT branch, from auth.users).
    --     When v_promote_profile is false, keep the user's existing
    --     role/active/shop_id (they are primary in another shop).
    INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
    SELECT
        au.id,
        COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
        COALESCE(au.raw_user_meta_data ->> 'name', au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
        au.email,
        v_final_role,
        ARRAY['pos_access']::TEXT[],
        p_active,
        p_shop_id
    FROM auth.users au
    WHERE au.id = p_user_id
    ON CONFLICT (id) DO UPDATE SET
        role = CASE WHEN v_promote_profile THEN v_final_role ELSE public.users.role END,
        active = CASE WHEN v_promote_profile THEN p_active ELSE public.users.active END,
        shop_id = CASE WHEN v_promote_profile THEN p_shop_id ELSE public.users.shop_id END;

    -- Defensive: the EF guarantees auth.users exists, but never let the
    -- membership insert fail on a missing FK target.
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'user_id', p_user_id
        );
    END IF;

    -- 3b. Upsert shop_memberships. ALREADY_MEMBER is now handled
    --     gracefully: re-provisioning the same (user, shop) updates the
    --     membership in place (idempotent role/active refresh). A phantom
    --     membership on a DIFFERENT shop is untouched — the phantom shop
    --     cleanup below cascades it away.
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (p_user_id, p_shop_id, v_final_role, true)
    ON CONFLICT (user_id, shop_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active;

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
            'active', p_active,
            'method', CASE WHEN p_token IS NOT NULL THEN 'invitation' ELSE 'direct' END,
            'profile_promoted', v_promote_profile
        )
    );

    -- ================================================================
    -- 4. Phantom shop cleanup (proven-bug remediation)
    --    Deletes a shop created when this EF-staff user fell through to the
    --    self-registration branch (the app_metadata-gate bug). Strictly
    --    gated so a LEGITIMATE pending owner shop is never touched:
    --      - the user's auth metadata has staff_creation='true' (only EF
    --        staff users carry this — live-verified: exactly 1 user, the
    --        smoke cashier). Legit self-reg owners never have it.
    --      - shop.owner_id = p_user_id
    --      - shop.is_active = false (pending)
    --      - no ACTIVE membership in the shop
    --      - no products and no sales (no real tenant data)
    --    Wrapped in a nested exception block: if cleanup ever fails (e.g.
    --    unexpected FK rows), provisioning STILL succeeds — we log, don't
    --    block. When in doubt, don't delete.
    -- ================================================================
    BEGIN
        -- The users.shop_id FK (NO ACTION) to this shop is ALREADY clear:
        -- when v_promote_profile is true, 3a re-pointed p_user_id to
        -- p_shop_id; when false, users.shop_id already points at the user's
        -- primary shop, not the phantom. Either way the DELETE below will
        -- not hit a users.shop_id FK — and if some OTHER FK child exists,
        -- the nested EXCEPTION logs delete_phantom_shop_failed and
        -- provisioning still succeeds (when in doubt, don't block).
        SELECT s.id INTO v_phantom_shop_id
        FROM public.shops s
        WHERE s.owner_id = p_user_id
          AND s.is_active = false
          AND EXISTS (
              SELECT 1 FROM auth.users au
              WHERE au.id = p_user_id
                AND COALESCE(au.raw_user_meta_data ->> 'staff_creation', '') = 'true'
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.shop_memberships sm
              WHERE sm.shop_id = s.id AND sm.is_active = true
          )
          -- Belt-and-suspenders: phantom shops carry no tenant data. If ANY
          -- of these exist, this is not a provably-empty fallthrough shop —
          -- skip (when in doubt, don't delete).
          AND NOT EXISTS (SELECT 1 FROM public.products p     WHERE p.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.sales sa       WHERE sa.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.categories c   WHERE c.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.customers cu   WHERE cu.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.discounts d    WHERE d.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.suppliers su   WHERE su.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.sales_tabs st  WHERE st.shop_id = s.id)
        LIMIT 1;

        IF v_phantom_shop_id IS NOT NULL THEN
            -- NO-ACTION FK children removed before the shop delete
            -- (memberships cascade via shop_memberships_shop_id_fkey).
            DELETE FROM public.app_settings WHERE shop_id = v_phantom_shop_id;
            DELETE FROM public.audit_logs   WHERE shop_id = v_phantom_shop_id;

            DELETE FROM public.shops WHERE id = v_phantom_shop_id;

            INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
            VALUES (
                p_invited_by,
                'delete_phantom_shop',
                'shop',
                v_phantom_shop_id,
                p_shop_id,
                jsonb_build_object('reason', 'staff fallthrough phantom shop cleanup')
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Never let cleanup block provisioning. Log and continue.
        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
        VALUES (
            p_invited_by,
            'delete_phantom_shop_failed',
            'shop',
            v_phantom_shop_id,
            p_shop_id,
            jsonb_build_object('error', SQLERRM)
        );
    END;

    -- ================================================================
    -- 5. Return success
    -- ================================================================
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- RESTRICT access — match 20260731170000/20260731171000
-- CREATE OR REPLACE preserves the ACL, but re-assert it for clarity.
-- ================================================================
REVOKE ALL ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) TO service_role;
