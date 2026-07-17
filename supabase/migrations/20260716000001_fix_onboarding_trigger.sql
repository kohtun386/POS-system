-- ================================================================
-- FIX ONBOARDING TRIGGER — Create Shop + Membership on Signup
-- Generated on: July 16, 2026
-- Description:
--   Per VISION.md §6.3, new signups must create:
--   1. public.users (inactive — pending approval)
--   2. shops (inactive — pending approval)
--   3. shop_memberships (inactive — pending approval)
--
--   Previous trigger only created public.users + shop_memberships
--   (both active). Missing: shops row, inactive states.
--
--   This migration:
--   - Updates handle_new_auth_user() to create all 3 rows
--   - Sets inactive states for pending approval flow
--   - Backfills shops for existing users missing one
-- ================================================================

-- ================================================================
-- 1. UPDATE TRIGGER FUNCTION
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
    INSERT INTO public.users (id, username, name, email, role, permissions, active)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'cashier',
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
-- 2. BACKFILL: Create shops for existing users missing one
-- ================================================================

-- Create shops for users who don't have one yet
INSERT INTO public.shops (name, email, owner_id, is_active)
SELECT
    COALESCE(u.name, split_part(u.email, '@', 1)) || '''s Coffee Shop',
    u.email,
    u.id,
    true  -- Existing users are already active
FROM public.users u
LEFT JOIN public.shop_memberships sm ON sm.user_id = u.id
WHERE sm.id IS NULL
ON CONFLICT DO NOTHING;

-- Create memberships for users who don't have one yet
INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
SELECT
    u.id,
    (SELECT id FROM public.shops WHERE owner_id = u.id LIMIT 1),
    COALESCE(u.role, 'cashier'),
    COALESCE(u.active, true)
FROM public.users u
LEFT JOIN public.shop_memberships sm
    ON sm.user_id = u.id
WHERE sm.id IS NULL
AND EXISTS (SELECT 1 FROM public.shops WHERE owner_id = u.id)
ON CONFLICT DO NOTHING;

-- ================================================================
-- 3. REVOKE EXECUTE from client roles
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- All auth users should have a public.users row:
-- SELECT au.email, pu.id IS NOT NULL AS has_profile
-- FROM auth.users au
-- LEFT JOIN public.users pu ON au.id = pu.id;

-- All users should have a shop:
-- SELECT u.email, s.name AS shop_name, s.is_active
-- FROM public.users u
-- LEFT JOIN public.shops s ON s.owner_id = u.id;

-- All users should have a membership:
-- SELECT u.email, sm.role, sm.is_active
-- FROM public.users u
-- LEFT JOIN public.shop_memberships sm ON sm.user_id = u.id;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
