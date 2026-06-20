-- ================================================================
-- FIX: Users can't read own profile after shop_id RLS
-- Generated on: June 20, 2026
-- Bug:
--   users SELECT policy requires shop_id IN current_shop_ids().
--   But current_shop_ids() queries shop_memberships.
--   New users (created after Chunk 1 migration) have no
--   shop_memberships row → current_shop_ids() = empty →
--   shop_id IN () = FALSE → can't read OWN profile.
--
--   Result: loadProfile() fails. state.currentUser = null.
--   App.tsx shows LoginPage. User can't log in.
--
-- Fix:
--   1. users SELECT: always allow reading own profile (auth.uid() = id)
--   2. handle_new_auth_user(): also insert shop_memberships row
--      for default shop so new users have at least one membership
--   3. Backfill: insert shop_memberships for any users missing one
-- ================================================================

-- ================================================================
-- 1. FIX USERS SELECT POLICY — allow self-read
-- ================================================================

DROP POLICY IF EXISTS "Users viewable by shop members" ON users;

CREATE POLICY "Users viewable by shop members" ON users
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      -- Always allow reading own profile (needed for AuthContext.loadProfile)
      auth.uid() = id
      -- Or read other users in same shop
      OR shop_id IN (SELECT public.current_shop_ids())
    )
  );

-- ================================================================
-- 2. FIX handle_new_auth_user() — auto-create shop_memberships
--    Inserts default shop membership for every new user.
--    Role defaults to 'cashier' (same as profile default).
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    v_username TEXT;
    v_name TEXT;
    v_default_shop_id UUID := '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
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

    INSERT INTO public.users (id, username, name, email, role, permissions, active)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'cashier',
        ARRAY['pos_access']::TEXT[],
        true
    );

    -- Also create default shop_memberships row so user can
    -- pass RLS checks immediately after signup.
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (
        NEW.id,
        v_default_shop_id,
        'cashier',
        true
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ================================================================
-- 3. BACKFILL — insert shop_memberships for users missing one
--    (covers users created between Chunk 1 migration and now)
-- ================================================================

INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
SELECT
    u.id,
    '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid,
    COALESCE(u.role, 'cashier'),
    COALESCE(u.active, true)
FROM public.users u
LEFT JOIN public.shop_memberships sm
    ON sm.user_id = u.id
    AND sm.shop_id = '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid
WHERE sm.id IS NULL;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- All users should have shop_memberships:
-- SELECT u.email, sm.role FROM users u
-- LEFT JOIN shop_memberships sm ON sm.user_id = u.id
-- WHERE sm.id IS NULL;
-- Expected: 0 rows

-- User should be able to read own profile:
-- (Run as authenticated user via app)
-- SELECT * FROM users WHERE id = auth.uid();
-- Expected: returns user's own profile row
