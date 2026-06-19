-- ================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- Generated on: June 19, 2026
-- Description:
--   When a new user is created in auth.users (via Dashboard, API,
--   or app sign-up), automatically create a corresponding row in
--   public.users with role 'cashier' and default permissions.
--   This prevents 406 errors when frontend queries the user's
--   profile immediately after auth.
-- ================================================================

-- ================================================================
-- 1. CREATE THE TRIGGER FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    v_username TEXT;
    v_name TEXT;
BEGIN
    -- Extract name/username from raw_user_meta_data (set by app sign-up)
    -- or from raw_app_meta_data, with fallbacks for Dashboard-created users
    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)  -- fallback: use email prefix as username
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)  -- fallback: use email prefix as name
    );

    INSERT INTO public.users (id, username, name, email, role, permissions, active)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'cashier',                         -- DEFAULT: lowest privilege
        ARRAY['pos_access']::TEXT[],        -- DEFAULT: POS-only access
        true
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 2. ATTACH TRIGGER TO auth.users
-- ================================================================

-- Drop if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- ================================================================
-- 3. BACKFILL: Create profile for existing auth users missing one
-- ================================================================

INSERT INTO public.users (id, username, name, email, role, permissions, active)
SELECT
    au.id,
    COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
    COALESCE(
        au.raw_user_meta_data ->> 'name',
        au.raw_user_meta_data ->> 'full_name',
        split_part(au.email, '@', 1)
    ),
    au.email,
    'cashier',
    ARRAY['pos_access']::TEXT[],
    true
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- ================================================================
-- 4. HARDEN: Revoke EXECUTE on this function from client roles
--    (SECURITY DEFINER trigger — should only fire internally)
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ================================================================

-- All auth users should have a public.users row:
-- SELECT au.email, pu.id IS NOT NULL AS has_profile
-- FROM auth.users au
-- LEFT JOIN public.users pu ON au.id = pu.id;

-- Expected: all rows have has_profile = true
-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
