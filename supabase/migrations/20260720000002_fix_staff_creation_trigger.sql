-- ================================================================
-- FIX STAFF CREATION TRIGGER — Gate on staff_creation metadata flag
-- Generated on: July 23, 2026
-- Description:
--   When `handle_new_auth_user()` fires for a user created via
--   the `staff-create` Edge Function, `raw_user_meta_data` contains
--   `staff_creation: true`. The trigger detects this flag and ONLY
--   inserts the user profile — it skips shop + membership creation,
--   preventing phantom shops.
--
--   Self-registration (no staff_creation flag) is unchanged:
--   creates users + shops + memberships as before.
--
--   VISION.md §17.3 — Edge Function Inventory
--   Related: platform-admin-scope-free-tier-staff-limit-analysis.md
-- ================================================================

-- ================================================================
-- 1. UPDATE TRIGGER FUNCTION with staff_creation gate
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
    --   The staff-create Edge Function handles the membership
    --   insert separately via service_role client.
    -- ================================================================
    IF v_is_staff THEN
        v_target_role := COALESCE(
            NEW.raw_user_meta_data ->> 'target_role',
            'cashier'
        );

        INSERT INTO public.users (id, username, name, email, role, permissions, active)
        VALUES (
            NEW.id,
            v_username,
            v_name,
            NEW.email,
            v_target_role,
            ARRAY['pos_access']::TEXT[],
            true  -- Staff users are active immediately (admin approved)
        );

        RETURN NEW;
    END IF;

    -- ================================================================
    -- BRANCH B: Self-Registration (Shop Owner)
    --   Create user + shop + membership (existing flow)
    -- ================================================================

    -- Extract shop name from metadata (passed by signup form)
    v_shop_name := COALESCE(
        NEW.raw_user_meta_data ->> 'shop_name',
        v_name || '''s Coffee Shop'  -- fallback: "Name's Coffee Shop"
    );

    -- 1. Create user profile (INACTIVE — pending approval)
    --    Role = 'admin' since this user is creating a new shop (shop owner)
    INSERT INTO public.users (id, username, name, email, role, permissions, active)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'admin',  -- Shop owner gets admin role (VISION.md §4.1)
        ARRAY['pos_access']::TEXT[],
        false  -- INACTIVE: pending platform admin approval
    );

    -- 2. Create shop (INACTIVE — pending approval)
    INSERT INTO public.shops (name, email, owner_id, is_active)
    VALUES (
        v_shop_name,
        NEW.email,
        NEW.id,
        false  -- INACTIVE: pending platform admin approval
    )
    RETURNING id INTO v_new_shop_id;

    -- 3. Create shop membership (INACTIVE — pending approval)
    --    Role = 'admin' since this user is the shop owner
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (
        NEW.id,
        v_new_shop_id,
        'admin',  -- Shop owner gets admin role
        false     -- INACTIVE: pending platform admin approval
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 2. REVOKE EXECUTE from client roles
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Test staff creation behavior:
-- Staff user should have NO shop and NO membership:
-- SELECT id, role, active FROM public.users WHERE id = 'STAFF_USER_ID';
-- SELECT COUNT(*) FROM public.shops WHERE owner_id = 'STAFF_USER_ID';  -- expect 0
-- SELECT COUNT(*) FROM public.shop_memberships WHERE user_id = 'STAFF_USER_ID';  -- expect 0 (membership added by Edge Function separately)

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
