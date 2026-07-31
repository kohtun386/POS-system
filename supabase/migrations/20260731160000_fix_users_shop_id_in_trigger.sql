-- ================================================================
-- P0 FIX — Populate users.shop_id in handle_new_auth_user()
-- Generated on: July 31, 2026
-- Description:
--   users.shop_id has a NOT NULL constraint (20260620000001,
--   default removed later in 20260726044400) but handle_new_auth_user()
--   never populated it. This broke:
--   1. Self-registration (new shop owners) — INSERT fails
--   2. Staff creation (admin adding staff) — INSERT fails
--
--   This migration adds shop_id to both INSERT statements:
--   - Self-registration: uses v_new_shop_id (newly created shop)
--   - Staff creation: uses shop_id from raw_user_meta_data
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
    -- Check if this is a staff creation (via staff-create Edge Function)
    v_is_staff := COALESCE(
        (NEW.raw_user_meta_data ->> 'staff_creation')::BOOLEAN,
        false
    );

    -- Extract name/username from raw_user_meta_data (set by app sign-up or staff-create Edge Function)
    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- ================================================================
    -- BRANCH A: Staff Creation (via Edge Function)
    --   Only insert user profile. Skip shop + membership.
    --   shop_id comes from raw_user_meta_data (set by Edge Function).
    -- ================================================================
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

    -- ================================================================
    -- BRANCH B: Self-Registration (Shop Owner)
    --   Create user + shop + membership. shop_id = newly created shop.
    -- ================================================================

    v_shop_name := COALESCE(
        NEW.raw_user_meta_data ->> 'shop_name',
        v_name || '''s Coffee Shop'
    );

    -- 1. Create shop first (INACTIVE — pending approval)
    --    We need the shop ID BEFORE inserting the user (users.shop_id is NOT NULL)
    INSERT INTO public.shops (name, email, owner_id, is_active)
    VALUES (
        v_shop_name,
        NEW.email,
        NEW.id,
        false
    )
    RETURNING id INTO v_new_shop_id;

    -- 2. Create user profile (INACTIVE — pending approval)
    --    shop_id = newly created shop captured above
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

    -- 3. Create shop membership (INACTIVE — pending approval)
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

-- ================================================================
-- REVOKE EXECUTE from client roles (as per migration-safety.md)
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;