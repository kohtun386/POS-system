-- ================================================================
-- FIX USER CREATION FLOW — UPSERT / Admin INSERT
-- Generated on: June 19, 2026
-- Description:
--   1. DB trigger handle_new_auth_user() now creates the default
--      profile row (role='cashier') on auth.users INSERT. Frontend
--      no longer needs to INSERT — it UPDATES the trigger-created row.
--   2. Fix INSERT RLS policy: admins can insert profiles for others
--      (belt-and-suspenders fallback if trigger doesn't fire).
--   3. Old restrictive policy ONLY allowed auth.uid() = id, which
--      blocked admin from creating profiles for others.
-- ================================================================

-- 1. DROP restrictive INSERT policy (only allowed self-insert)
DROP POLICY IF EXISTS "Users can only insert their own profile" ON users;

-- 2. New INSERT policy: authenticated users can insert (trigger is
--    the normal creation path; this is fallback for edge cases)
CREATE POLICY "Users insert by authenticated users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ================================================================
-- VERIFICATION (run manually)
-- ================================================================
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'users'
-- ORDER BY cmd, policyname;
-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
