-- ================================================================
-- Migration: platform_admin_cleanup — cleanup_test_data RPC
-- Date: 2026-08-08
-- Description:
--   Creates cleanup_test_data() RPC for the platform-admin-cleanup
--   Edge Function. Removes transient E2E onboarding/reject test
--   data ONLY — never touches seed fixtures, tier accounts, or
--   platform admin users.
--
--   Scoping (hardcoded WHERE clauses — never parameterized to
--   prevent accidental misuse):
--     shops:   is_active = false AND owner email matches
--              'onboarding-*@coffeeshop.local' OR 'reject-*@coffeeshop.local'
--              AND NOT one of 4 protected seed shop UUIDs.
--     users:   users in scoped shops, email LIKE '%@coffeeshop.local'
--              AND NOT '%@test.local' (excludes tier seeds) AND NOT
--              platform_admin role.
--
--   Tables deleted: audit_logs → app_settings → shop_memberships →
--   users → shops (FK-safe order).
--
--   Returns JSONB with counts and dry_run flag.
--
--   FIX 1 — p_dry_run is FUNCTIONAL. Default TRUE (safer). When
--   true, runs SELECT COUNT(*) with same WHERE clauses and returns
--   preview — no DELETE, no audit_logs INSERT.
--
--   FIX 2 — NO EXCEPTION HANDLER. PostgreSQL native transaction
--   rollback handles any failure → atomic. Audit log INSERT is
--   the last DML before RETURN — only runs on success.
--
--   FIX 5 — Scope is HARD-LIMITED to 5 onboarding tables. No
--   sales, sales_tabs, discounts, products, customers. Future E2E
--   tests that create those must add their own cleanup.
--
--   VISION.md §4.3 (platform_admin), §17 (Edge Functions).
-- ================================================================

CREATE OR REPLACE FUNCTION public.cleanup_test_data(
    p_dry_run BOOLEAN DEFAULT TRUE,
    p_approver_id UUID DEFAULT NULL
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_audit_logs_count INTEGER := 0;
    v_app_settings_count INTEGER := 0;
    v_shop_memberships_count INTEGER := 0;
    v_users_count INTEGER := 0;
    v_shops_count INTEGER := 0;
    v_scoped_shop_ids UUID[];
BEGIN
    -- ================================================================
    -- 0. Validate caller is platform_admin (defense-in-depth; EF
    --    also verifies via verifyPlatformAdmin)
    -- ================================================================
    IF p_approver_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_approver_id AND role = 'platform_admin'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'dry_run', p_dry_run
        );
    END IF;

    -- ================================================================
    -- 1. Identify scoped shops: is_active = false (pending onboarding)
    --    + owner email matches E2E onboarding/reject pattern.
    --    EXCLUDES 4 protected seed shop UUIDs (default + tier shops).
    -- ================================================================
    SELECT COALESCE(array_agg(s.id), '{}') INTO v_scoped_shop_ids
    FROM public.shops s
    WHERE s.is_active = false
      AND s.id NOT IN (
          '4f3dab19-144e-4a29-95a5-2ee82f160ce5'::uuid, -- default platform admin shop
          '10000000-0000-0000-0000-000000000001'::uuid, -- Free Shop (seed)
          '20000000-0000-0000-0000-000000000002'::uuid, -- Growth Shop (seed)
          '30000000-0000-0000-0000-000000000003'::uuid  -- Pro Shop (seed)
      )
      AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.shop_id = s.id
            AND u.role <> 'platform_admin'
            AND (
                u.email ~ '^(onboarding-|reject-).*@coffeeshop\.local$'
            )
      );

    -- ================================================================
    -- 2. FIX 1: dry_run branch — COUNT only, no DELETE, no audit.
    -- ================================================================
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_audit_logs_count
        FROM public.audit_logs
        WHERE shop_id = ANY(v_scoped_shop_ids);

        SELECT COUNT(*) INTO v_app_settings_count
        FROM public.app_settings
        WHERE shop_id = ANY(v_scoped_shop_ids);

        SELECT COUNT(*) INTO v_shop_memberships_count
        FROM public.shop_memberships
        WHERE shop_id = ANY(v_scoped_shop_ids);

        SELECT COUNT(*) INTO v_users_count
        FROM public.users
        WHERE shop_id = ANY(v_scoped_shop_ids)
          AND role <> 'platform_admin'
          AND email LIKE '%@coffeeshop.local'
          AND email NOT LIKE '%@test.local';

        v_shops_count := array_length(v_scoped_shop_ids, 1);
        IF v_shops_count IS NULL THEN
            v_shops_count := 0;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'dry_run', true,
            'preview_counts', jsonb_build_object(
                'shops', v_shops_count,
                'users', v_users_count,
                'shop_memberships', v_shop_memberships_count,
                'app_settings', v_app_settings_count,
                'audit_logs', v_audit_logs_count
            )
        );
    END IF;

    -- ================================================================
    -- 3. DESTRUCTIVE PATH — delete in FK-safe order.
    --    PostgreSQL native transaction handles atomicity.
    --    No EXCEPTION block — if anything fails, full rollback.
    -- ================================================================

    -- 3a. audit_logs (references shops)
    DELETE FROM public.audit_logs
    WHERE shop_id = ANY(v_scoped_shop_ids);
    GET DIAGNOSTICS v_audit_logs_count = ROW_COUNT;

    -- 3b. app_settings (references shops)
    DELETE FROM public.app_settings
    WHERE shop_id = ANY(v_scoped_shop_ids);
    GET DIAGNOSTICS v_app_settings_count = ROW_COUNT;

    -- 3c. shop_memberships (references shops + users)
    DELETE FROM public.shop_memberships
    WHERE shop_id = ANY(v_scoped_shop_ids);
    GET DIAGNOSTICS v_shop_memberships_count = ROW_COUNT;

    -- 3d. users (in scoped shops, exclude platform_admin + tier seeds)
    DELETE FROM public.users
    WHERE shop_id = ANY(v_scoped_shop_ids)
      AND role <> 'platform_admin'
      AND email LIKE '%@coffeeshop.local'
      AND email NOT LIKE '%@test.local';
    GET DIAGNOSTICS v_users_count = ROW_COUNT;

    -- 3e. shops (parent — last)
    DELETE FROM public.shops
    WHERE id = ANY(v_scoped_shop_ids);
    GET DIAGNOSTICS v_shops_count = ROW_COUNT;

    -- ================================================================
    -- 4. Audit log (single row, success only — FIX 2)
    -- ================================================================
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_approver_id,
        'cleanup_test_data',
        'system',
        NULL,
        NULL,
        jsonb_build_object(
            'dry_run', false,
            'deleted_shops', v_shops_count,
            'deleted_users', v_users_count,
            'deleted_shop_memberships', v_shop_memberships_count,
            'deleted_app_settings', v_app_settings_count,
            'deleted_audit_logs', v_audit_logs_count,
            'note', 'cleanup_test_data RPC — onboarding test data only'
        )
    );

    -- ================================================================
    -- 5. Return final result (audit_log INSERT is the last DML — atomic)
    -- ================================================================
    RETURN jsonb_build_object(
        'success', true,
        'dry_run', false,
        'deleted_counts', jsonb_build_object(
            'shops', v_shops_count,
            'users', v_users_count,
            'shop_memberships', v_shop_memberships_count,
            'app_settings', v_app_settings_count,
            'audit_logs', v_audit_logs_count
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke from client roles (service_role only via Edge Function)
REVOKE EXECUTE ON FUNCTION public.cleanup_test_data(BOOLEAN, UUID)
FROM anon, authenticated;

-- Grant to service_role (required for Edge Function admin client — same pattern as approve_shop fix)
GRANT EXECUTE ON FUNCTION public.cleanup_test_data(BOOLEAN, UUID)
TO service_role;

-- ================================================================
-- VERIFICATION (run after apply)
-- ================================================================
-- SELECT proacl FROM pg_proc WHERE proname = 'cleanup_test_data';
-- Expected: {service_role=X/postgres, postgres=X/postgres} — and NO bare '=X/...' (PUBLIC) entry.
-- service_role can execute: SELECT has_function_privilege('service_role', 'public.cleanup_test_data(bool,uuid)', 'EXECUTE');
-- Expected: true.
