-- ================================================================
-- Clean up phantom shops created by the old broken trigger.
-- The old `handle_new_auth_user()` trigger created a new shop for
-- every staff member signup, leaving orphan shops with 0 products,
-- 0 sales, and 0 members.
--
-- Fixed in 20260720000002 (staff creation trigger fix) and
-- 20260720000003 (RLS tier check), but existing phantom shops
-- must be cleaned up.
--
-- Safety: Only targets shops with 0 in ALL of:
--   - products (product_count = 0)
--   - sales (sale_count = 0)
--   - shop_memberships (member_count = 0)
--   - users (user_count = 0)
-- This ensures no active shops are affected.
--
-- Order of operations:
--   1. Identify phantom shops (0 products, 0 sales, 0 members, 0 users)
--   2. Delete their audit_logs (FK: NO ACTION on shop_id)
--   3. Delete their app_settings rows (FK: fk_app_settings_shop, NO ACTION)
--   4. Delete the shops (CASCADE handles remaining FK tables)
--
-- Excludes the seed shop (4f3dab19-144e-4a29-95a5-2ee82f160ce5).
-- ================================================================

WITH phantom_shops AS (
    SELECT s.id
    FROM shops s
    WHERE s.id != '4f3dab19-144e-4a29-95a5-2ee82f160ce5'
      AND (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) = 0
      AND (SELECT COUNT(*) FROM sales sa WHERE sa.shop_id = s.id) = 0
      AND (SELECT COUNT(*) FROM shop_memberships sm WHERE sm.shop_id = s.id) = 0
      AND (SELECT COUNT(*) FROM users u WHERE u.shop_id = s.id) = 0
),
deleted_audit_logs AS (
    DELETE FROM audit_logs
    WHERE shop_id IN (SELECT id FROM phantom_shops)
    RETURNING shop_id
),
deleted_settings AS (
    DELETE FROM app_settings
    WHERE shop_id IN (SELECT id FROM phantom_shops)
    RETURNING shop_id
)
DELETE FROM shops
WHERE id IN (SELECT id FROM phantom_shops);
