BEGIN;

-- Load pgTAP (idempotent)
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(24);

-- ==========================================================================
-- 1. FIXTURES — 3 shops (free/growth/pro), admin+cashier users, memberships.
--    GUC-stashed IDs for use in outer SQL body.
-- ==========================================================================

DO $$
DECLARE
  -- Shops
  v_free_shop   uuid := gen_random_uuid();
  v_growth_shop uuid := gen_random_uuid();
  v_pro_shop    uuid := gen_random_uuid();

  -- Users
  v_free_admin     uuid := gen_random_uuid();
  v_free_cashier   uuid := gen_random_uuid();
  v_growth_admin   uuid := gen_random_uuid();
  v_growth_cashier uuid := gen_random_uuid();
  v_pro_admin      uuid := gen_random_uuid();
  v_pro_cashier    uuid := gen_random_uuid();

  -- Cross-tenant user (member of growth only)
  v_cross_admin uuid := gen_random_uuid();
  v_cross_shop  uuid := gen_random_uuid();

  -- Pre-created auth user for Test 2 (growth admin inserts new staff)
  v_new_staff_id uuid := gen_random_uuid();
BEGIN
  -- Stash all IDs as GUCs
  PERFORM set_config('test.free_shop',       v_free_shop::text,   true);
  PERFORM set_config('test.growth_shop',     v_growth_shop::text, true);
  PERFORM set_config('test.pro_shop',        v_pro_shop::text,    true);
  PERFORM set_config('test.free_admin',      v_free_admin::text,  true);
  PERFORM set_config('test.free_cashier',    v_free_cashier::text, true);
  PERFORM set_config('test.growth_admin',    v_growth_admin::text, true);
  PERFORM set_config('test.growth_cashier',  v_growth_cashier::text, true);
  PERFORM set_config('test.pro_admin',       v_pro_admin::text,   true);
  PERFORM set_config('test.pro_cashier',     v_pro_cashier::text, true);
  PERFORM set_config('test.cross_admin',     v_cross_admin::text, true);
  PERFORM set_config('test.cross_shop',      v_cross_shop::text,  true);
  PERFORM set_config('test.new_staff_id',    v_new_staff_id::text, true);

  -- Shops
  INSERT INTO shops (id, name, subscription_tier, is_active) VALUES
    (v_free_shop,   'Test Free Shop',   'free',   true),
    (v_growth_shop, 'Test Growth Shop', 'growth', true),
    (v_pro_shop,    'Test Pro Shop',    'pro',    true)
  ON CONFLICT (id) DO NOTHING;

  -- Cross-tenant shop (growth tier)
  INSERT INTO shops (id, name, subscription_tier, is_active) VALUES
    (v_cross_shop, 'Cross Tenant Shop', 'growth', true)
  ON CONFLICT (id) DO NOTHING;

  -- Feature definitions needed for capability checks
  INSERT INTO feature_definitions (key, name, description, category, default_enabled, subscription_tier)
  VALUES
    ('staff_accounts',    'Staff Accounts',    'Staff accounts',    'general', true, 'growth'),
    ('inventory',         'Inventory',         'Inventory',         'general', true, 'free'),
    ('discounts',         'Discounts',         'Discounts',         'pos',     true, 'free'),
    ('customer_management','Customer Management','Customer management','customers', true, 'free'),
    ('printer_integration','Printer Integration','Printer',         'general', true, 'growth'),
    ('stock_overview',    'Stock Overview',    'Stock overview',    'general', true, 'growth')
  ON CONFLICT (key) DO NOTHING;

  -- Auth users (triggers handle_new_auth_user creates users + shop_memberships)
  -- Emails use p2_ prefix to avoid collision with seed.sql usernames
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  VALUES
    (v_free_admin,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_free_admin@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_free_admin","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_free_cashier, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_free_cashier@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_free_cashier","role":"cashier"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_growth_admin,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_growth_admin@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_growth_admin","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_growth_cashier, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_growth_cashier@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_growth_cashier","role":"cashier"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_pro_admin,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_pro_admin@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_pro_admin","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_pro_cashier, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_pro_cashier@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_pro_cashier","role":"cashier"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    (v_cross_admin, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_cross_admin@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_cross_admin","role":"admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
    -- Pre-created auth user for Test 2 (growth admin inserts new staff)
    (v_new_staff_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated',
     'p2_new_staff@test.local', extensions.crypt('Test@1234', extensions.gen_salt('bf')),
     now(), '{"username":"p2_new_staff","role":"cashier"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Delete trigger-created public.users row for new_staff (Test 2 will INSERT it fresh)
  DELETE FROM public.users WHERE id = v_new_staff_id;

  -- Public users (upsert to fix role/active set by trigger)
  -- Usernames use p2_ prefix to avoid collision with seed.sql usernames
  INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
  VALUES
    (v_free_admin,      'p2_free_admin',      'P2 Free Admin',      'p2_free_admin@test.local',      'admin',   ARRAY['all']::text[], true, v_free_shop),
    (v_free_cashier,    'p2_free_cashier',    'P2 Free Cashier',    'p2_free_cashier@test.local',    'cashier', ARRAY['all']::text[], true, v_free_shop),
    (v_growth_admin,    'p2_growth_admin',    'P2 Growth Admin',    'p2_growth_admin@test.local',    'admin',   ARRAY['all']::text[], true, v_growth_shop),
    (v_growth_cashier,  'p2_growth_cashier',  'P2 Growth Cashier',  'p2_growth_cashier@test.local',  'cashier', ARRAY['all']::text[], true, v_growth_shop),
    (v_pro_admin,       'p2_pro_admin',       'P2 Pro Admin',       'p2_pro_admin@test.local',       'admin',   ARRAY['all']::text[], true, v_pro_shop),
    (v_pro_cashier,     'p2_pro_cashier',     'P2 Pro Cashier',     'p2_pro_cashier@test.local',     'cashier', ARRAY['all']::text[], true, v_pro_shop),
    (v_cross_admin,     'p2_cross_admin',     'P2 Cross Admin',     'p2_cross_admin@test.local',     'admin',   ARRAY['all']::text[], true, v_cross_shop)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, active = true, permissions = ARRAY['all']::text[], shop_id = EXCLUDED.shop_id;

  -- Shop memberships
  INSERT INTO shop_memberships (user_id, shop_id, role, is_active)
  VALUES
    (v_free_admin,      v_free_shop,   'admin',   true),
    (v_free_cashier,    v_free_shop,   'cashier', true),
    (v_growth_admin,    v_growth_shop, 'admin',   true),
    (v_growth_cashier,  v_growth_shop, 'cashier', true),
    (v_pro_admin,       v_pro_shop,    'admin',   true),
    (v_pro_cashier,     v_pro_shop,    'cashier', true),
    (v_cross_admin,     v_cross_shop,  'admin',   true)
  ON CONFLICT (user_id, shop_id) DO UPDATE SET
    role = EXCLUDED.role, is_active = true;

  RAISE NOTICE 'Fixtures created: 4 shops, 8 auth users, 7 public users, 7 memberships';
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
-- 3. USERS TABLE — 3 tests (G1 regression + admin insert + self-edit)
-- ==========================================================================

-- Test 1: Free-tier admin CANNOT INSERT users (G1 regression: staff_accounts gate)
SELECT _login('test.free_admin');

SELECT throws_ok(
  format(
    'INSERT INTO users (id, username, name, email, role, permissions, active, shop_id)
     VALUES (%L, ''new_user'', ''New User'', ''new@test.local'', ''cashier'', ARRAY[''all'']::text[], false, %L)',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- Test 2: Growth admin CAN INSERT users (has staff_accounts capability)
-- Pre-created auth user v_new_staff_id exists in auth.users (FK satisfied)
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO users (id, username, name, email, role, permissions, active, shop_id)
     VALUES (%L, ''p2_new_staff'', ''New Staff'', ''p2_new_staff@test.local'', ''cashier'', ARRAY[''all'']::text[], false, %L)',
    current_setting('test.new_staff_id'), current_setting('test.growth_shop')
  ),
  'Growth admin CAN INSERT users (staff_accounts capability gate passed)'
);

-- Test 3: Self-edit allowed (admin updates own profile)
SELECT _login('test.free_admin');

SELECT lives_ok(
  format(
    'UPDATE users SET name = ''P2 Free Admin Updated'' WHERE id = %L',
    current_setting('test.free_admin')
  ),
  'Self-edit allowed (admin updates own profile)'
);

-- ==========================================================================
-- 4. SALES TABLE — 3 tests
-- ==========================================================================

-- Test 4: Admin can INSERT sales
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO sales (id, shop_id, invoice_number, items, payments, subtotal, tax_amount, total, discount_amount, cashier, cashier_id)
     VALUES (%L, %L, ''INV-TEST-001'', ''[]''::jsonb, ''[]''::jsonb, 0, 0, 0, 0, ''Test'', %L)',
    gen_random_uuid(), current_setting('test.growth_shop'), current_setting('test.growth_admin')
  ),
  'Admin can INSERT sales in own shop'
);

-- Test 5: Cashier cannot UPDATE sales (role gate — admin/manager only)
-- UPDATE denied returns empty result set (not error) — use results_eq
SELECT _login('test.growth_cashier');

SELECT results_eq(
  format(
    'UPDATE sales SET notes = ''hacked'' WHERE shop_id = %L AND invoice_number = ''INV-TEST-001'' RETURNING id',
    current_setting('test.growth_shop')
  ),
  ARRAY[]::uuid[],
  'cashier UPDATE on sales is denied (role gate)'
);

-- Test 6: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO sales (id, shop_id, invoice_number, items, payments, subtotal, tax_amount, total, discount_amount, cashier, cashier_id)
     VALUES (%L, %L, ''INV-TEST-003'', ''[]''::jsonb, ''[]''::jsonb, 0, 0, 0, 0, ''Test'', %L)',
    gen_random_uuid(), current_setting('test.free_shop'), current_setting('test.growth_admin')
  ),
  42501
);

-- ==========================================================================
-- 5. PRODUCTS TABLE — 3 tests
-- ==========================================================================

-- Test 7: Admin can INSERT products
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO products (id, shop_id, name, sku, price, category, active, is_weight_based, track_inventory)
     VALUES (%L, %L, ''Test Product'', ''SKU-P2-001'', 1000, ''Drinks'', true, false, false)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  'Admin can INSERT products in own shop'
);

-- Test 8: Cashier cannot INSERT products
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO products (id, shop_id, name, sku, price, category, active, is_weight_based, track_inventory)
     VALUES (%L, %L, ''Unauthorized'', ''SKU-P2-002'', 1000, ''Drinks'', true, false, false)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  42501
);

-- Test 9: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO products (id, shop_id, name, sku, price, category, active, is_weight_based, track_inventory)
     VALUES (%L, %L, ''Cross Tenant'', ''SKU-P2-003'', 1000, ''Drinks'', true, false, false)',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- 6. CUSTOMERS TABLE — 3 tests
-- ==========================================================================

-- Test 10: Admin can INSERT customers
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO customers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Test Customer'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  'Admin can INSERT customers in own shop'
);

-- Test 11: Cashier cannot INSERT customers
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO customers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Unauthorized'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  42501
);

-- Test 12: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO customers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Cross Tenant'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- 7. DISCOUNTS TABLE — 3 tests
-- ==========================================================================

-- Test 13: Admin can INSERT discounts
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO discounts (id, shop_id, name, type, value, valid_from, valid_to, active)
     VALUES (%L, %L, ''Test Discount'', ''percentage'', 10,
             now(), now() + interval ''30 days'', true)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  'Admin can INSERT discounts in own shop'
);

-- Test 14: Cashier cannot INSERT discounts
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO discounts (id, shop_id, name, type, value, valid_from, valid_to, active)
     VALUES (%L, %L, ''Unauthorized'', ''percentage'', 10,
             now(), now() + interval ''30 days'', true)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  42501
);

-- Test 15: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO discounts (id, shop_id, name, type, value, valid_from, valid_to, active)
     VALUES (%L, %L, ''Cross Tenant'', ''percentage'', 10,
             now(), now() + interval ''30 days'', true)',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- 8. CATEGORIES TABLE — 3 tests
-- ==========================================================================

-- Test 16: Admin can INSERT categories
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO categories (id, shop_id, name, active)
     VALUES (%L, %L, ''P2 Test Category'', true)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  'Admin can INSERT categories in own shop'
);

-- Test 17: Cashier cannot INSERT categories
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO categories (id, shop_id, name, active)
     VALUES (%L, %L, ''P2 Unauthorized'', true)',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  42501
);

-- Test 18: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO categories (id, shop_id, name, active)
     VALUES (%L, %L, ''P2 Cross Tenant'', true)',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- 9. SUPPLIERS TABLE — 3 tests
--    NOTE: suppliers INSERT policy requires has_capability(shop_id, 'stock_overview')
-- ==========================================================================

-- Test 19: Admin can INSERT suppliers (growth shop has stock_overview)
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO suppliers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Test Supplier'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  'Admin can INSERT suppliers in own shop (stock_overview capability)'
);

-- Test 20: Cashier cannot INSERT suppliers
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO suppliers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Unauthorized'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.growth_shop')
  ),
  42501
);

-- Test 21: Cross-tenant INSERT denied
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO suppliers (id, shop_id, name, phone)
     VALUES (%L, %L, ''Cross Tenant'', ''0912345678'')',
    gen_random_uuid(), current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- 10. APP_SETTINGS TABLE — 3 tests
--     NOTE: No unique constraint on shop_id — use plain INSERT.
--     Fixture shops don't have app_settings rows yet.
-- ==========================================================================

-- Test 22: Admin can INSERT app_settings
SELECT _login('test.growth_admin');

SELECT lives_ok(
  format(
    'INSERT INTO app_settings (shop_id, store_name, interface_mode, theme, auto_backup, invoice_prefix, invoice_counter)
     VALUES (%L, ''Growth Settings'', ''touch'', ''light'', true, ''INV'', 1000)',
    current_setting('test.growth_shop')
  ),
  'Admin can INSERT app_settings in own shop'
);

-- Test 23: Cashier cannot INSERT app_settings
SELECT _login('test.growth_cashier');

SELECT throws_ok(
  format(
    'INSERT INTO app_settings (shop_id, store_name, interface_mode, theme, auto_backup, invoice_prefix, invoice_counter)
     VALUES (%L, ''Unauthorized'', ''touch'', ''light'', true, ''INV'', 1000)',
    current_setting('test.growth_shop')
  ),
  42501
);

-- Test 24: Cross-tenant INSERT denied on app_settings
SELECT _login('test.growth_admin');

SELECT throws_ok(
  format(
    'INSERT INTO app_settings (shop_id, store_name, interface_mode, theme, auto_backup, invoice_prefix, invoice_counter)
     VALUES (%L, ''Cross Tenant'', ''touch'', ''light'', true, ''INV'', 1000)',
    current_setting('test.free_shop')
  ),
  42501
);

-- ==========================================================================
-- FINISH
-- ==========================================================================

SELECT * FROM finish();
ROLLBACK;
