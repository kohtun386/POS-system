BEGIN;

-- Load pgTAP (idempotent)
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- ==========================================================================
-- 1. FIXTURES — gen_random_uuid() avoids seed.sql collisions.
--    IDs stashed in transaction-scoped GUCs via set_config(..., true).
-- ==========================================================================

DO $$
DECLARE
  v_shopA_id     uuid := gen_random_uuid();
  v_shopB_id     uuid := gen_random_uuid();
  v_adminA_id    uuid := gen_random_uuid();
  v_cashierA_id  uuid := gen_random_uuid();
  v_adminB_id    uuid := gen_random_uuid();
BEGIN
  -- Stash IDs as GUCs for the outer SQL body
  PERFORM set_config('test.shopA_id',    v_shopA_id::text,    true);
  PERFORM set_config('test.shopB_id',    v_shopB_id::text,    true);
  PERFORM set_config('test.adminA_id',   v_adminA_id::text,   true);
  PERFORM set_config('test.cashierA_id', v_cashierA_id::text, true);
  PERFORM set_config('test.adminB_id',   v_adminB_id::text,   true);

  INSERT INTO shops (id, name, subscription_tier, is_active) VALUES
    (v_shopA_id, 'Shop A', 'growth', true),
    (v_shopB_id, 'Shop B', 'growth', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (v_adminA_id,   'adminA@test.local',   '{"role":"admin"}'::jsonb),
    (v_cashierA_id, 'cashierA@test.local', '{"role":"cashier"}'::jsonb),
    (v_adminB_id,   'adminB@test.local',   '{"role":"admin"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id, username, name, email, role, shop_id, active) VALUES
    (v_adminA_id,   'adminA_test',   'Admin A',   'adminA@test.local',   'admin',   v_shopA_id, true),
    (v_cashierA_id, 'cashierA_test', 'Cashier A', 'cashierA@test.local', 'cashier', v_shopA_id, true),
    (v_adminB_id,   'adminB_test',   'Admin B',   'adminB@test.local',   'admin',   v_shopB_id, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO shop_memberships (user_id, shop_id, role, is_active) VALUES
    (v_adminA_id,   v_shopA_id, 'admin',   true),
    (v_cashierA_id, v_shopA_id, 'cashier', true),
    (v_adminB_id,   v_shopB_id, 'admin',   true)
  ON CONFLICT (user_id, shop_id) DO NOTHING;
END $$;

-- ==========================================================================
-- 2. HELPER: _login(guc_name) — simulates JWT session via EXECUTE
--    SET LOCAL rejects function calls, so we must use EXECUTE.
--    Reads the UUID from a GUC set by the fixture DO block above.
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
-- 3. TEST SUITE: shop_memberships — Tenant Isolation + No-Recursion
-- ==========================================================================

-- Test 1: adminA can SELECT their own membership in shopA
SELECT _login('test.adminA_id');

SELECT results_eq(
  format('SELECT shop_id::text FROM shop_memberships WHERE user_id = %L AND shop_id = %L',
         current_setting('test.adminA_id'), current_setting('test.shopA_id')),
  ARRAY[current_setting('test.shopA_id')],
  'adminA can SELECT own membership in shopA'
);

-- Test 2: adminA CANNOT see adminB memberships (cross-tenant deny)
SELECT results_eq(
  format('SELECT user_id FROM shop_memberships WHERE user_id = %L',
         current_setting('test.adminB_id')),
  ARRAY[]::uuid[],
  'adminA cannot see adminB memberships (cross-tenant isolation)'
);

-- Test 3: cashier CANNOT UPDATE memberships (admin-only write)
SELECT _login('test.cashierA_id');

SELECT results_eq(
  format('UPDATE shop_memberships SET role = ''admin'' WHERE user_id = %L RETURNING user_id',
         current_setting('test.adminA_id')),
  ARRAY[]::uuid[],
  'cashier UPDATE on shop_memberships is denied'
);

-- Test 4: SELECT on shop_memberships completes WITHOUT RLS recursion error
SELECT _login('test.adminA_id');

SELECT lives_ok(
  'SELECT COUNT(*) FROM shop_memberships',
  'SELECT on shop_memberships completes without RLS recursion'
);

-- ==========================================================================
-- 4. TEST SUITE: users — Self-Edit, Cross-User Deny, Delete Deny
-- ==========================================================================

-- Test 5: authenticated user can SELECT users
SELECT results_eq(
  format('SELECT id FROM users WHERE id = %L',
         current_setting('test.adminA_id')),
  ARRAY[current_setting('test.adminA_id')::uuid],
  'adminA can SELECT own user record'
);

-- Test 6: adminA can UPDATE own row (self-edit)
SELECT lives_ok(
  format('UPDATE users SET name = ''Admin A Updated'' WHERE id = %L',
         current_setting('test.adminA_id')),
  'adminA can UPDATE own user record (self-edit)'
);

-- Test 7: cashier CANNOT update admin's row (not self, not admin)
SELECT _login('test.cashierA_id');

SELECT results_eq(
  format('UPDATE users SET name = ''Hacked'' WHERE id = %L RETURNING id',
         current_setting('test.adminA_id')),
  ARRAY[]::uuid[],
  'cashier cannot UPDATE admin user record (role-gate)'
);

-- Test 8: DELETE on users is denied for authenticated (no DELETE policy)
SELECT results_eq(
  format('DELETE FROM users WHERE id = %L RETURNING id',
         current_setting('test.adminA_id')),
  ARRAY[]::uuid[],
  'authenticated user cannot DELETE user records (implicit deny)'
);

-- ==========================================================================
-- 5. TEST SUITE: shops — Cross-Tenant Write Deny
-- ==========================================================================

-- Test 9: adminA cannot UPDATE Shop B (cross-tenant write deny)
SELECT _login('test.adminA_id');

SELECT results_eq(
  format('UPDATE shops SET name = ''Hacked'' WHERE id = %L RETURNING id',
         current_setting('test.shopB_id')),
  ARRAY[]::uuid[],
  'adminA cannot UPDATE Shop B (cross-tenant protection)'
);

SELECT * FROM finish();

ROLLBACK;
