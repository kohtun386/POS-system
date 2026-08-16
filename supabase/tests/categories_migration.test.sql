BEGIN;

-- Load pgTAP (idempotent)
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- ==========================================================================
-- 1. FIXTURES — 2 growth-tier shops, 1 admin per shop.
--    GUC-stashed IDs for use in outer SQL body.
-- ==========================================================================

DO $$
DECLARE
  -- Shops
  v_shop_a uuid := gen_random_uuid();
  v_shop_b uuid := gen_random_uuid();

  -- Users (admins only — need INSERT on products + categories)
  v_admin_a uuid := gen_random_uuid();
  v_admin_b uuid := gen_random_uuid();

  -- Categories
  v_drinks_a uuid := gen_random_uuid();
  v_food_a   uuid := gen_random_uuid();
  v_target_b uuid := gen_random_uuid();
BEGIN
  -- Stash all IDs as GUCs
  PERFORM set_config('test.shop_a',     v_shop_a::text,     true);
  PERFORM set_config('test.shop_b',     v_shop_b::text,     true);
  PERFORM set_config('test.admin_a',    v_admin_a::text,    true);
  PERFORM set_config('test.admin_b',    v_admin_b::text,    true);
  PERFORM set_config('test.drinks_a',   v_drinks_a::text,   true);
  PERFORM set_config('test.food_a',     v_food_a::text,     true);
  PERFORM set_config('test.target_b',   v_target_b::text,   true);

  -- Shops
  INSERT INTO shops (id, name, subscription_tier, is_active) VALUES
    (v_shop_a, 'Cat Test Shop A', 'growth', true),
    (v_shop_b, 'Cat Test Shop B', 'growth', true)
  ON CONFLICT (id) DO NOTHING;

  -- Auth users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES
    (v_admin_a, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'cat_admin_a@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"cat_admin_a","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_admin_b, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'cat_admin_b@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"cat_admin_b","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Public users
  INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
  VALUES
    (v_admin_a, 'cat_admin_a', 'Cat Admin A', 'cat_admin_a@test.local', 'admin', ARRAY['all']::text[], true, v_shop_a),
    (v_admin_b, 'cat_admin_b', 'Cat Admin B', 'cat_admin_b@test.local', 'admin', ARRAY['all']::text[], true, v_shop_b)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, active = true, permissions = ARRAY['all']::text[], shop_id = EXCLUDED.shop_id;

  -- Shop memberships
  INSERT INTO shop_memberships (user_id, shop_id, role, is_active)
  VALUES
    (v_admin_a, v_shop_a, 'admin', true),
    (v_admin_b, v_shop_b, 'admin', true)
  ON CONFLICT (user_id, shop_id) DO UPDATE SET
    role = EXCLUDED.role, is_active = true;

  -- Categories (pre-create for tests 1, 3, 4, 5, 6, 9)
  INSERT INTO categories (id, shop_id, name, active) VALUES
    (v_drinks_a, v_shop_a, 'Drinks', true),
    (v_food_a,   v_shop_a, 'Food',   true),
    (v_target_b, v_shop_b, 'Snacks', true)
  ON CONFLICT (shop_id, lower(name)) DO NOTHING;

  RAISE NOTICE 'Fixtures created: 2 shops, 2 admins, 2 memberships, 3 categories';
END $$;

-- ==========================================================================
-- 2. HELPER: _login(guc_name) — simulates JWT session
-- ==========================================================================

CREATE OR REPLACE FUNCTION _login(p_guc text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  EXECUTE format(
    'SET LOCAL request.jwt.claim.sub = %L',
    current_setting(p_guc)
  );
  SET LOCAL request.jwt.claim.role = 'authenticated';
  SET ROLE authenticated;
END $$;

-- ==========================================================================
-- 3. TRIGGER: sync_category_id_from_string — tests 1-5
-- ==========================================================================

-- Test 1: INSERT product with matching category text → category_id auto-populated
SELECT _login('test.admin_a');

INSERT INTO products (id, shop_id, name, sku, price, category, active, is_weight_based, track_inventory)
VALUES (gen_random_uuid(), current_setting('test.shop_a')::uuid, 'Latte', 'SKU-CAT-001', 5000, 'Drinks', true, false, true);

SELECT is(
  (SELECT category_id::text FROM products WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid),
  (SELECT id::text FROM categories WHERE name = 'Drinks' AND shop_id = current_setting('test.shop_a')::uuid),
  'INSERT with matching category text → category_id auto-populated by trigger'
);

-- Test 2: INSERT product with non-existent category → category_id stays NULL
INSERT INTO products (id, shop_id, name, sku, price, category, active, is_weight_based, track_inventory)
VALUES (gen_random_uuid(), current_setting('test.shop_a')::uuid, 'Mystery Item', 'SKU-CAT-002', 3000, 'Nonexistent', true, false, true);

SELECT is(
  (SELECT category_id::text FROM products WHERE sku = 'SKU-CAT-002' AND shop_id = current_setting('test.shop_a')::uuid),
  NULL,
  'INSERT with non-existent category → category_id stays NULL'
);

-- Test 3: UPDATE product category to different existing category → category_id updates
UPDATE products SET category = 'Food' WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid;

SELECT is(
  (SELECT category_id::text FROM products WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid),
  (SELECT id::text FROM categories WHERE name = 'Food' AND shop_id = current_setting('test.shop_a')::uuid),
  'UPDATE to different category → category_id updates to match'
);

-- Test 4: UPDATE product category to SAME value → category_id unchanged (TG_OP guard)
UPDATE products SET category = 'Food' WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid;

SELECT is(
  (SELECT category_id::text FROM products WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid),
  (SELECT id::text FROM categories WHERE name = 'Food' AND shop_id = current_setting('test.shop_a')::uuid),
  'UPDATE to same category → category_id unchanged (TG_OP guard regression check)'
);

-- Test 5: UPDATE product category to empty string → category_id set to NULL
UPDATE products SET category = '' WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid;

SELECT is(
  (SELECT category_id::text FROM products WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid),
  NULL,
  'UPDATE to empty string → category_id set to NULL'
);

-- ==========================================================================
-- 4. CASE-INSENSITIVE UNIQUE INDEX — tests 6-7
-- ==========================================================================

-- Test 6: INSERT 'drinks' (different case) in SAME shop → throws_ok
SELECT _login('test.admin_a');

SELECT throws_ok(
  format(
    'INSERT INTO categories (id, shop_id, name, active)
     VALUES (%L, %L, ''drinks'', true)',
    gen_random_uuid(), current_setting('test.shop_a')
  ),
  23505
);

-- Test 7: INSERT 'drinks' in DIFFERENT shop → lives_ok (per-shop scoping)
SELECT _login('test.admin_b');

SELECT lives_ok(
  format(
    'INSERT INTO categories (id, shop_id, name, active)
     VALUES (%L, %L, ''drinks'', true)',
    gen_random_uuid(), current_setting('test.shop_b')
  ),
  'INSERT same name in different shop → succeeds (per-shop scoping)'
);

-- ==========================================================================
-- 5. COMPOSITE FK TENANT SAFETY — tests 8-9
-- ==========================================================================

-- Test 8: UPDATE product category_id to a different shop's category → throws_ok (FK violation)
-- Uses UPDATE (not INSERT) so the trigger — which only fires on "UPDATE OF category" — cannot run.
SELECT _login('test.admin_a');

SELECT throws_ok(
  format(
    'UPDATE products SET category_id = %L WHERE sku = ''SKU-CAT-001'' AND shop_id = %L',
    current_setting('test.target_b'), current_setting('test.shop_a')
  ),
  23503
);

-- Test 9: DELETE category with referencing product → throws_ok
-- First restore a valid category_id on the product
UPDATE products SET category = 'Food' WHERE sku = 'SKU-CAT-001' AND shop_id = current_setting('test.shop_a')::uuid;

SELECT throws_ok(
  format(
    'DELETE FROM categories WHERE id = %L',
    current_setting('test.food_a')
  ),
  23503
);

-- ==========================================================================
-- FINISH
-- ==========================================================================

SELECT * FROM finish();
ROLLBACK;
