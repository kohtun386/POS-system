-- ================================================================
-- DEVELOPMENT SEED: Platform Admin Accounts + Tier Test Accounts
-- ================================================================
-- ⚠️  FOR LOCAL DEVELOPMENT ONLY — NEVER RUN IN PRODUCTION ⚠️
--
-- This file contains core setup data (users, shops, memberships).
-- For demo/test product data, run: npx supabase db execute supabase/seed-demo-data.sql
--
-- It runs automatically after `supabase db reset`.
--
-- Platform admin credentials:
--   1. kohtunhtun386@gmail.com / 131986kohtun@  (personal dev)
--   2. test-admin@coffeeshop.local / TestAdmin123! (E2E testing)
--
-- Tier test accounts (password: Test@1234):
--   3-shop matrix: Free / Growth / Pro × admin / manager / cashier
--   + multi-shop user (admin @ Growth + cashier @ Pro)
--
-- Idempotent: safe to run multiple times.
-- ================================================================

-- ================================================================
-- STEP 1: CLEANUP — Remove phantom shops from on_auth_user_created.
-- The trigger fires on every auth.users INSERT and creates inactive
-- shops + users + memberships + app_settings rows. We clean these
-- up after all auth inserts and before inserting real data.
-- ================================================================

-- 1a. Platform admin auth users (creates phantoms)
DO $$
DECLARE
  v_shop_id UUID := '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid;
  v_users JSONB := '[
    {"id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "email": "kohtunhtun386@gmail.com", "password": "131986kohtun@", "username": "kohtunhtun386", "name": "Ko HTun", "role": "platform_admin"},
    {"id": "b1ffcc88-2d31-4f7a-9c7e-7cc8ae491b22", "email": "test-admin@coffeeshop.local", "password": "TestAdmin123!", "username": "test_admin", "name": "Test Admin", "role": "platform_admin"},
    {"id": "c2dd8899-3e42-4f7a-ae8e-8cc9cf001122", "email": "test-admin-manager@coffeeshop.local", "password": "TestAdmin123!", "username": "test_admin_manager", "name": "Test Admin Manager", "role": "admin"}
  ]'::jsonb;
  v_item JSONB;
  v_user_id UUID;
  v_existing UUID;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_users)
  LOOP
    v_user_id := (v_item->>'id')::uuid;
    SELECT id INTO v_existing FROM auth.users WHERE email = v_item->>'email';

    IF v_existing IS NULL THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change, email_change_token_new, email_change_token_current,
        reauthentication_token, raw_user_meta_data, raw_app_meta_data,
        created_at, updated_at
      ) VALUES (
        v_user_id, '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated', 'authenticated', v_item->>'email',
        extensions.crypt(v_item->>'password', extensions.gen_salt('bf')),
        now(), '', '', '', '', '', '',
        jsonb_build_object('username', v_item->>'username', 'name', v_item->>'name'),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        now(), now()
      );
      RAISE NOTICE 'Created auth user: %', v_item->>'email';
    ELSE
      v_user_id := v_existing;
      RAISE NOTICE 'Auth user already exists: %', v_item->>'email';
    END IF;

    INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
    VALUES (v_user_id, v_item->>'username', v_item->>'name', v_item->>'email',
            v_item->>'role', ARRAY['all']::text[], true, v_shop_id)
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role, active = true, permissions = ARRAY['all']::text[], updated_at = now();

    -- No shop_memberships row for platform_admin — their role isn't in the
    -- CHECK constraint (admin/manager/cashier only) and they don't need RLS
    -- access (they use Edge Functions with service_role which bypasses RLS).

    RAISE NOTICE 'User seeded: % (role=%, active=true)', v_item->>'email', v_item->>'role';
  END LOOP;
END $$;

-- 1b. Tier test auth users (creates phantoms)
DO $$
DECLARE
  v_password TEXT := 'Test@1234';
  v_free_admin     UUID := '10000000-0000-0000-0000-000000000011'::uuid;
  v_free_cashier   UUID := '10000000-0000-0000-0000-000000000012'::uuid;
  v_growth_admin   UUID := '20000000-0000-0000-0000-000000000021'::uuid;
  v_growth_cashier UUID := '20000000-0000-0000-0000-000000000022'::uuid;
  v_growth_manager UUID := '20000000-0000-0000-0000-000000000023'::uuid;
  v_pro_admin      UUID := '30000000-0000-0000-0000-000000000031'::uuid;
  v_pro_manager    UUID := '30000000-0000-0000-0000-000000000033'::uuid;
  v_multi_shop     UUID := '90000000-0000-0000-0000-000000000091'::uuid;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    reauthentication_token, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at
  )
  SELECT v.id, '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated', v.email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(), '', '', '', '', '', '',
    jsonb_build_object('username', v.username, 'name', v.name),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    now(), now()
  FROM (VALUES
    (v_free_admin,     'free_admin',     'Free Admin',     'free-admin@test.local'),
    (v_free_cashier,   'free_cashier',   'Free Cashier',   'free-cashier@test.local'),
    (v_growth_admin,   'growth_admin',   'Growth Admin',   'growth-admin@test.local'),
    (v_growth_cashier, 'growth_cashier', 'Growth Cashier', 'growth-cashier@test.local'),
    (v_growth_manager, 'growth_manager', 'Growth Manager', 'growth-manager@test.local'),
    (v_pro_admin,      'pro_admin',      'Pro Admin',      'pro-admin@test.local'),
    (v_pro_manager,    'pro_manager',    'Pro Manager',    'pro-manager@test.local'),
    (v_multi_shop,     'multi_shop',     'Multi Shop',     'multi-shop@test.local')
  ) AS v(id, username, name, email)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.email = v.email);

  RAISE NOTICE 'Auth users seeded: 8 tier test accounts';
END $$;

-- ================================================================
-- 1c. CLEANUP ALL PHANTOM SHOPS — runs after all auth inserts.
--     Deletes inactive shops + their children in FK-safe order.
-- ================================================================
DO $$
BEGIN
  DELETE FROM public.app_settings
  WHERE shop_id IN (SELECT id FROM public.shops WHERE is_active = false);

  DELETE FROM public.shop_memberships
  WHERE shop_id IN (SELECT id FROM public.shops WHERE is_active = false);

  DELETE FROM public.users
  WHERE shop_id IN (SELECT id FROM public.shops WHERE is_active = false);

  DELETE FROM public.shops WHERE is_active = false;

  RAISE NOTICE 'All phantom shops cleaned up';
END $$;

-- ================================================================
-- STEP 2: SHOPS — insert real shops with correct tiers/limits.
-- handle_new_shop_app_settings() fires → app_settings created.
-- ================================================================
DO $$
DECLARE
  v_free_shop   UUID := '10000000-0000-0000-0000-000000000001'::uuid;
  v_growth_shop UUID := '20000000-0000-0000-0000-000000000002'::uuid;
  v_pro_shop    UUID := '30000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  INSERT INTO public.shops (id, name, subscription_tier, daily_order_limit, business_type, is_active)
  VALUES
    (v_free_shop,   'Free Shop',   'free',   50,  'coffee_shop', true),
    (v_growth_shop, 'Growth Shop', 'growth', NULL, 'coffee_shop', true),
    (v_pro_shop,    'Pro Shop',    'pro',    NULL, 'coffee_shop', true)
  ON CONFLICT (id) DO UPDATE SET
    subscription_tier = EXCLUDED.subscription_tier,
    daily_order_limit = EXCLUDED.daily_order_limit,
    is_active = true;

  RAISE NOTICE 'Shops seeded: Free, Growth, Pro';
END $$;

-- ================================================================
-- STEP 3: PUBLIC UPSERT ROLES — upsert public.users with correct
-- roles and shop assignments. (Trigger already created them with
-- role='admin', active=false — we fix that here.)
-- ================================================================
DO $$
DECLARE
  v_free_shop   UUID := '10000000-0000-0000-0000-000000000001'::uuid;
  v_growth_shop UUID := '20000000-0000-0000-0000-000000000002'::uuid;
  v_pro_shop    UUID := '30000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
  VALUES
    ('10000000-0000-0000-0000-000000000011'::uuid, 'free_admin',     'Free Admin',     'free-admin@test.local',     'admin',   ARRAY['all']::text[], true, v_free_shop),
    ('10000000-0000-0000-0000-000000000012'::uuid, 'free_cashier',   'Free Cashier',   'free-cashier@test.local',   'cashier', ARRAY['all']::text[], true, v_free_shop),
    ('20000000-0000-0000-0000-000000000021'::uuid, 'growth_admin',   'Growth Admin',   'growth-admin@test.local',   'admin',   ARRAY['all']::text[], true, v_growth_shop),
    ('20000000-0000-0000-0000-000000000022'::uuid, 'growth_cashier', 'Growth Cashier', 'growth-cashier@test.local', 'cashier', ARRAY['all']::text[], true, v_growth_shop),
    ('20000000-0000-0000-0000-000000000023'::uuid, 'growth_manager', 'Growth Manager', 'growth-manager@test.local', 'manager', ARRAY['all']::text[], true, v_growth_shop),
    ('30000000-0000-0000-0000-000000000031'::uuid, 'pro_admin',      'Pro Admin',      'pro-admin@test.local',      'admin',   ARRAY['all']::text[], true, v_pro_shop),
    ('30000000-0000-0000-0000-000000000033'::uuid, 'pro_manager',    'Pro Manager',    'pro-manager@test.local',    'manager', ARRAY['all']::text[], true, v_pro_shop),
    ('90000000-0000-0000-0000-000000000091'::uuid, 'multi_shop',     'Multi Shop',     'multi-shop@test.local',     'admin',   ARRAY['all']::text[], true, v_growth_shop)
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role, active = true, permissions = ARRAY['all']::text[], updated_at = now();

  RAISE NOTICE 'Public users seeded: 8 tier test accounts';
END $$;

-- ================================================================
-- STEP 4: SHOP MEMBERSHIPS — 9 rows (multi-shop user has 2)
-- ================================================================
DO $$
DECLARE
  v_free_shop   UUID := '10000000-0000-0000-0000-000000000001'::uuid;
  v_growth_shop UUID := '20000000-0000-0000-0000-000000000002'::uuid;
  v_pro_shop    UUID := '30000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
  VALUES
    -- Free Shop
    ('10000000-0000-0000-0000-000000000011'::uuid, v_free_shop,   'admin',   true),
    ('10000000-0000-0000-0000-000000000012'::uuid, v_free_shop,   'cashier', true),
    -- Growth Shop
    ('20000000-0000-0000-0000-000000000021'::uuid, v_growth_shop, 'admin',   true),
    ('20000000-0000-0000-0000-000000000022'::uuid, v_growth_shop, 'cashier', true),
    ('20000000-0000-0000-0000-000000000023'::uuid, v_growth_shop, 'manager', true),
    ('90000000-0000-0000-0000-000000000091'::uuid, v_growth_shop, 'admin',   true),
    -- Pro Shop
    ('30000000-0000-0000-0000-000000000031'::uuid, v_pro_shop,    'admin',   true),
    ('30000000-0000-0000-0000-000000000033'::uuid, v_pro_shop,    'manager', true),
    ('90000000-0000-0000-0000-000000000091'::uuid, v_pro_shop,    'cashier', true)
  ON CONFLICT (user_id, shop_id) DO UPDATE SET
    role = EXCLUDED.role, is_active = true;

  RAISE NOTICE 'Shop memberships seeded: 9 rows (multi-shop has 2)';
END $$;
