-- ================================================================
-- FIX OWNER ROLE ASSIGNMENT
-- Generated on: July 17, 2026
-- Description:
--   The handle_new_auth_user() trigger was hardcoding users.role = 'cashier'
--   for ALL new signups, including shop owners. Per VISION.md §4.1, the
--   first user to sign up for a new shop is the Shop Owner and MUST be
--   assigned the 'admin' role.
--
--   This migration:
--   1. Backfills existing shop owners to have users.role = 'admin'
--   2. Updates the trigger to assign 'admin' role to new shop owners
-- ================================================================

-- ================================================================
-- 1. BACKFILL: Fix existing shop owners
-- ================================================================

-- Update users who are shop owners (have shop_memberships.role = 'admin')
-- to also have users.role = 'admin'
UPDATE public.users
SET role = 'admin'
WHERE id IN (
    SELECT sm.user_id
    FROM public.shop_memberships sm
    WHERE sm.role = 'admin'
    AND sm.is_active = true
)
AND role != 'admin';

-- Also update users who own shops directly
UPDATE public.users
SET role = 'admin'
WHERE id IN (
    SELECT s.owner_id
    FROM public.shops s
    WHERE s.is_active = true
)
AND role != 'admin';

-- ================================================================
-- 2. UPDATE TRIGGER FUNCTION: Assign 'admin' to new shop owners
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
BEGIN
    -- Extract name/username from raw_user_meta_data (set by app sign-up)
    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

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
-- 3. REVOKE EXECUTE from client roles
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- Verify all shop owners have admin role:
-- SELECT u.email, u.role, sm.role AS membership_role
-- FROM public.users u
-- JOIN public.shop_memberships sm ON sm.user_id = u.id
-- WHERE sm.role = 'admin'
-- AND u.role != 'admin';

-- Should return 0 rows after successful migration

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
