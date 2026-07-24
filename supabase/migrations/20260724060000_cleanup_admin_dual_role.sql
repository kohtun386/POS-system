-- ================================================================
-- Clean up the dual-role (shop_memberships + platform_admin) user.
--
-- VISION.md §4.3: platform_admin MUST NOT have shop_memberships
-- rows. The platform admin account is a separate identity used
-- exclusively for cross-shop operations via Edge Functions, never
-- for daily POS operations at a specific shop.
--
-- The user kohtunhtun386@gmail.com was found to have BOTH:
--   - a shop_memberships row (acting as a shop member)
--   - users.role = 'platform_admin'
--
-- This migration removes the shop_memberships row and demotes the
-- role to 'admin' (Shop Owner), making this user a strict shop-level
-- admin. Platform admin duties should be handled via the separate
-- admin@coffeepos.com account.
--
-- Idempotent: safe to run multiple times — DELETE and UPDATE are
-- no-ops if the target rows no longer exist.
-- ================================================================

WITH target_user AS (
    SELECT id FROM users WHERE email = 'kohtunhtun386@gmail.com'
),
deleted_memberships AS (
    DELETE FROM shop_memberships
    WHERE user_id IN (SELECT id FROM target_user)
    RETURNING user_id
)
UPDATE users
SET role = 'admin'
WHERE email = 'kohtunhtun386@gmail.com'
  AND role = 'platform_admin';

COMMENT ON TABLE users IS 'VISION.md §4.3: platform_admin MUST NOT have shop_memberships rows';
