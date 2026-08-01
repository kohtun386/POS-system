-- ================================================================
-- SECURITY HARDENING — handle_new_auth_user() staff-branch gate
-- LOCAL MIRROR of remote-applied migration 20260731162223.
--
-- This migration was applied directly to the LIVE database on
-- 2026-07-31 16:22:23 UTC (via SQL, no local file existed) to
-- re-apply the hardened staff-branch gate after 20260731160000 was
-- pushed. It is recreated here so `supabase db push` sees local and
-- remote migration history in sync (LegacyDbPushMissingLocalError).
--
-- NOTE: the body below is the app_metadata.staff_provisioned gate,
-- which is PROVEN UNREACHABLE for an AFTER INSERT trigger (GoTrue
-- writes app_metadata post-INSERT). The subsequent migration
-- 20260731170000_move_staff_auth_to_provision_user.sql replaces this
-- function with the corrected design. This file exists only to
-- reconcile migration history — the SQL is idempotent (CREATE OR
-- REPLACE) and is superseded by 20260731170000 in the same push.
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    v_username TEXT;
    v_name TEXT;
    v_shop_name TEXT;
    v_new_shop_id UUID;
    v_is_staff BOOLEAN;
    v_target_role TEXT;
    v_user_shop_id UUID;
BEGIN
    v_is_staff := COALESCE(
        (NEW.raw_app_meta_data ->> 'staff_provisioned')::BOOLEAN,
        false
    );

    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    IF v_is_staff THEN
        v_target_role := COALESCE(
            NEW.raw_user_meta_data ->> 'target_role',
            'cashier'
        );

        v_user_shop_id := (NEW.raw_user_meta_data ->> 'shop_id')::UUID;

        INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
        VALUES (
            NEW.id,
            v_username,
            v_name,
            NEW.email,
            v_target_role,
            ARRAY['pos_access']::TEXT[],
            true,
            v_user_shop_id
        );

        RETURN NEW;
    END IF;

    v_shop_name := COALESCE(
        NEW.raw_user_meta_data ->> 'shop_name',
        v_name || '''s Coffee Shop'
    );

    INSERT INTO public.shops (name, email, owner_id, is_active)
    VALUES (
        v_shop_name,
        NEW.email,
        NEW.id,
        false
    )
    RETURNING id INTO v_new_shop_id;

    INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'admin',
        ARRAY['pos_access']::TEXT[],
        false,
        v_new_shop_id
    );

    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (
        NEW.id,
        v_new_shop_id,
        'admin',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
