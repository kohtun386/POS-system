-- ================================================================
-- Migration: Move staff authorization from trigger into provision_user
-- Date: 2026-07-31
-- Description:
--   PROVEN BROKEN: handle_new_auth_user() gated its staff branch on
--   raw_app_meta_data ->> 'staff_provisioned'. GoTrue writes app_metadata
--   via a POST-INSERT UPDATE on auth.users, so an AFTER INSERT trigger
--   never sees it. Live smoke user (smoke.cashier@coffeeshop.local) has
--   staff_provisioned=true yet fell through to Branch B (self-reg) and got
--   a phantom shop (3361a160-9de5-4aa0-b692-e8955578f2c4) + admin/inactive
--   profile + phantom membership, alongside the correct real membership
--   created by provision_user.
--
--   Fix:
--     A. Trigger staff branch now gates on raw_user_meta_data.staff_creation
--        (written by the staff-create / staff-accept-invitation EFs). It
--        inserts ONLY a DORMANT cashier profile (role='cashier',
--        active=false, permissions=ARRAY['pos_access']). No shop, no
--        membership. The earlier escalation (attacker forging metadata to
--        claim role/active) is closed because role/active are HARDCODED,
--        not read from caller-controlled metadata. provision_user promotes
--        this dormant profile.
--     B. provision_user() now owns ALL authorization: it upserts
--        public.users (role/active/shop_id), upserts the shop_membership,
--        and cleans up the phantom shop left by the broken trigger.
--     C. REVOKE EXECUTE ON provision_user FROM PUBLIC — real revoke this
--        time (the old REVOKE FROM anon,authenticated never worked because
--        the default PUBLIC grant still applied). Grant only to service_role.
--
--   VISION.md §4.3 (platform_admin bypasses RLS via service_role EFs only),
--   §6 (Onboarding pipeline), §17.3 (Edge Function inventory).
-- ================================================================

-- ================================================================
-- A. TRIGGER: handle_new_auth_user()
-- ================================================================
-- Staff branch: gate on user_metadata.staff_creation (EF-controlled,
-- present in raw_user_meta_data at INSERT time — the app_metadata gate
-- is proven unreachable for an AFTER INSERT trigger). The branch is SAFE
-- even if forged: it hardcodes a dormant cashier profile; caller-supplied
-- target_role/active can no longer reach the DB. If metadata shop_id is
-- null/invalid/non-existent, the profile insert is SKIPPED (no NOT NULL
-- violation, no fabricated row) — provision_user self-heals via upsert.
-- Self-registration branch: unchanged (pending-approval owner shop).
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
DECLARE
    v_username TEXT;
    v_name TEXT;
    v_shop_name TEXT;
    v_new_shop_id UUID;
    v_is_staff BOOLEAN;
    v_user_shop_id UUID;
BEGIN
    -- String compare, not ::BOOLEAN cast, so malformed metadata ('garbage')
    -- safely defaults to false instead of raising on the cast.
    v_is_staff := (NEW.raw_user_meta_data ->> 'staff_creation') = 'true';

    -- Extract name/username from raw_user_meta_data (set by app sign-up or staff-create EF)
    v_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1)
    );

    v_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        split_part(NEW.email, '@', 1)
    );

    -- ================================================================
    -- BRANCH A: Staff Creation (via Edge Function)
    --   Entered when user_metadata.staff_creation='true' (set by the
    --   staff-create / staff-accept-invitation EFs). Inserts ONLY a
    --   DORMANT cashier profile. Membership + role promotion happen later
    --   in provision_user(). role/active are hardcoded so caller metadata
    --   cannot escalate. The dormant profile cannot be activated by the
    --   client (users UPDATE RLS pins role/active/shop_id on the self
    --   branch; admin branch requires users_get_own_role()='admin').
    -- ================================================================
    IF v_is_staff THEN
        -- Safe UUID parse: malformed metadata must never abort signup.
        BEGIN
            v_user_shop_id := NULLIF(NEW.raw_user_meta_data ->> 'shop_id', '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_user_shop_id := NULL;
        END;

        -- Only materialize a profile if shop_id is a real, existing shop.
        -- users.shop_id is NOT NULL and fk_users_shop (NO ACTION) would
        -- reject a dangling reference; skipping is the safe fallback.
        IF v_user_shop_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM public.shops WHERE id = v_user_shop_id) THEN
            INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
            VALUES (
                NEW.id,
                v_username,
                v_name,
                NEW.email,
                'cashier',
                ARRAY['pos_access']::TEXT[],
                false,
                v_user_shop_id
            );
        END IF;

        RETURN NEW;
    END IF;

    -- ================================================================
    -- BRANCH B: Self-Registration (Shop Owner)
    --   Create user + shop + membership. shop_id = newly created shop.
    --   No subscription_tier/daily_order_limit — DB defaults cover them.
    -- ================================================================

    v_shop_name := COALESCE(
        NEW.raw_user_meta_data ->> 'shop_name',
        v_name || '''s Coffee Shop'
    );

    -- 1. Create shop first (INACTIVE — pending approval)
    --    shops.owner_id has no FK; users.shop_id NOT NULL requires shop first.
    INSERT INTO public.shops (name, email, owner_id, is_active)
    VALUES (
        v_shop_name,
        NEW.email,
        NEW.id,
        false
    )
    RETURNING id INTO v_new_shop_id;

    -- 2. Create user profile (INACTIVE — pending approval)
    INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
    VALUES (
        NEW.id,
        v_username,
        v_name,
        NEW.email,
        'admin',
        ARRAY['pos_access']::TEXT[],
        false,
        v_new_shop_id
    );

    -- 3. Create shop membership (INACTIVE — pending approval)
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (
        NEW.id,
        v_new_shop_id,
        'admin',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger functions cannot be invoked directly (RETURNS TRIGGER), but
-- close the PUBLIC-execute default the same way we do for provision_user.
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

-- ================================================================
-- B. RPC: provision_user() — enhanced, owns staff authorization
-- ================================================================
-- Signature change: p_role REPLACED by p_target_role (+ p_active).
-- Because the argument list changes, the old 5-arg function would remain
-- as a latent PUBLIC-executable overload — drop it explicitly first.
-- New signature: (p_user_id uuid, p_shop_id uuid, p_invited_by uuid,
--                 p_token text, p_target_role text, p_active boolean)
--
-- Callers (updated in the same PR):
--   staff-create:              p_target_role=role, p_shop_id=shop_id, p_active=true
--   staff-accept-invitation B: p_target_role=invitation.role, p_active=true
--   staff-accept-invitation A: p_target_role=null (role resolved from invitation)
--
-- The RPC is the ONLY writer of role/active/shop_id for staff; it stays
-- SECURITY DEFINER + SET search_path='' and is restricted to service_role.
-- ================================================================

DROP FUNCTION IF EXISTS public.provision_user(UUID, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.provision_user(
    p_user_id UUID,
    p_shop_id UUID,
    p_invited_by UUID,
    p_token TEXT DEFAULT NULL,
    p_target_role TEXT DEFAULT NULL,
    p_active BOOLEAN DEFAULT true
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_invitation RECORD;
    v_final_role TEXT;
    v_user_email TEXT;
    v_phantom_shop_id UUID;
BEGIN
    -- ================================================================
    -- 1. Validate invitation token (if provided)
    -- ================================================================
    IF p_token IS NOT NULL THEN
        SELECT * INTO v_invitation
        FROM public.shop_invitations
        WHERE token = p_token
          AND accepted_at IS NULL
        FOR UPDATE;  -- Lock row to prevent double-accept (race condition)

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INVALID_TOKEN'
            );
        END IF;

        IF v_invitation.expires_at < now() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TOKEN_EXPIRED'
            );
        END IF;

        IF v_invitation.shop_id != p_shop_id THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TOKEN_SHOP_MISMATCH'
            );
        END IF;

        -- EMAIL BINDING: verify p_user_id's email matches the invitation email
        -- (prevents token theft). Read from auth.users (the authoritative
        -- account email) — the public.users profile may not exist yet if the
        -- trigger skipped the insert; the upsert below self-heals it.
        SELECT au.email INTO v_user_email
        FROM auth.users au WHERE au.id = p_user_id;

        IF v_user_email IS DISTINCT FROM v_invitation.email THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'EMAIL_MISMATCH',
                'expected', v_invitation.email,
                'provided_user_id', p_user_id
            );
        END IF;

        -- SOURCE OF TRUTH: role comes from invitation (prevents escalation)
        v_final_role := v_invitation.role;
    ELSE
        -- Direct admin/owner creation: role comes from parameter
        IF p_target_role IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'ROLE_REQUIRED'
            );
        END IF;
        v_final_role := p_target_role;
    END IF;

    -- ================================================================
    -- 2. Validate final role
    -- ================================================================
    IF v_final_role NOT IN ('admin', 'manager', 'cashier') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_ROLE'
        );
    END IF;

    -- ================================================================
    -- 3. Atomic provisioning (single RPC = single transaction)
    -- ================================================================

    -- 3a. Upsert public.users row — this is where staff authorization now
    --     happens. Handles both the trigger-created dormant profile
    --     (DO UPDATE promotes role/active/shop_id) and the edge case where
    --     the trigger skipped the insert (INSERT branch, from auth.users).
    INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
    SELECT
        au.id,
        COALESCE(au.raw_user_meta_data ->> 'username', split_part(au.email, '@', 1)),
        COALESCE(au.raw_user_meta_data ->> 'name', au.raw_user_meta_data ->> 'full_name', split_part(au.email, '@', 1)),
        au.email,
        v_final_role,
        ARRAY['pos_access']::TEXT[],
        p_active,
        p_shop_id
    FROM auth.users au
    WHERE au.id = p_user_id
    ON CONFLICT (id) DO UPDATE SET
        role = v_final_role,
        active = p_active,
        shop_id = p_shop_id;

    -- Defensive: the EF guarantees auth.users exists, but never let the
    -- membership insert fail on a missing FK target.
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'user_id', p_user_id
        );
    END IF;

    -- 3b. Upsert shop_memberships. ALREADY_MEMBER is now handled
    --     gracefully: re-provisioning the same (user, shop) updates the
    --     membership in place (idempotent role/active refresh). A phantom
    --     membership on a DIFFERENT shop is untouched — the phantom shop
    --     cleanup below cascades it away.
    INSERT INTO public.shop_memberships (user_id, shop_id, role, is_active)
    VALUES (p_user_id, p_shop_id, v_final_role, true)
    ON CONFLICT (user_id, shop_id) DO UPDATE SET
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active;

    -- 3c. Mark invitation as accepted (if token flow)
    IF p_token IS NOT NULL THEN
        UPDATE public.shop_invitations
        SET accepted_at = now()
        WHERE token = p_token;
    END IF;

    -- 3d. Log to audit_logs (atomic accountability)
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_invited_by,
        'provision_user',
        'user',
        p_user_id,
        p_shop_id,
        jsonb_build_object(
            'role', v_final_role,
            'active', p_active,
            'method', CASE WHEN p_token IS NOT NULL THEN 'invitation' ELSE 'direct' END
        )
    );

    -- ================================================================
    -- 4. Phantom shop cleanup (proven-bug remediation)
    --    Deletes a shop created when this EF-staff user fell through to the
    --    self-registration branch (the app_metadata-gate bug). Strictly
    --    gated so a LEGITIMATE pending owner shop is never touched:
    --      - the user's auth metadata has staff_creation='true' (only EF
    --        staff users carry this — live-verified: exactly 1 user, the
    --        smoke cashier). Legit self-reg owners never have it.
    --      - shop.owner_id = p_user_id
    --      - shop.is_active = false (pending)
    --      - no ACTIVE membership in the shop
    --      - no products and no sales (no real tenant data)
    --    Wrapped in a nested exception block: if cleanup ever fails (e.g.
    --    unexpected FK rows), provisioning STILL succeeds — we log, don't
    --    block. When in doubt, don't delete.
    -- ================================================================
    BEGIN
        -- The users.shop_id FK (NO ACTION) to this shop is ALREADY cleared:
        -- step 3a re-pointed p_user_id to p_shop_id before this block runs.
        SELECT s.id INTO v_phantom_shop_id
        FROM public.shops s
        WHERE s.owner_id = p_user_id
          AND s.is_active = false
          AND EXISTS (
              SELECT 1 FROM auth.users au
              WHERE au.id = p_user_id
                AND COALESCE(au.raw_user_meta_data ->> 'staff_creation', '') = 'true'
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.shop_memberships sm
              WHERE sm.shop_id = s.id AND sm.is_active = true
          )
          -- Belt-and-suspenders: phantom shops carry no tenant data. If ANY
          -- of these exist, this is not a provably-empty fallthrough shop —
          -- skip (when in doubt, don't delete).
          AND NOT EXISTS (SELECT 1 FROM public.products p     WHERE p.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.sales sa       WHERE sa.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.categories c   WHERE c.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.customers cu   WHERE cu.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.discounts d    WHERE d.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.suppliers su   WHERE su.shop_id = s.id)
          AND NOT EXISTS (SELECT 1 FROM public.sales_tabs st  WHERE st.shop_id = s.id)
        LIMIT 1;

        IF v_phantom_shop_id IS NOT NULL THEN
            -- NO-ACTION FK children removed before the shop delete
            -- (memberships cascade via shop_memberships_shop_id_fkey).
            DELETE FROM public.app_settings WHERE shop_id = v_phantom_shop_id;
            DELETE FROM public.audit_logs   WHERE shop_id = v_phantom_shop_id;

            DELETE FROM public.shops WHERE id = v_phantom_shop_id;

            INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
            VALUES (
                p_invited_by,
                'delete_phantom_shop',
                'shop',
                v_phantom_shop_id,
                p_shop_id,
                jsonb_build_object('reason', 'staff fallthrough phantom shop cleanup')
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Never let cleanup block provisioning. Log and continue.
        INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
        VALUES (
            p_invited_by,
            'delete_phantom_shop_failed',
            'shop',
            v_phantom_shop_id,
            p_shop_id,
            jsonb_build_object('error', SQLERRM)
        );
    END;

    -- ================================================================
    -- 5. Return success
    -- ================================================================
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- C. RESTRICT access — real revoke this time
-- ================================================================
-- The old REVOKE FROM anon, authenticated was a no-op: PostgreSQL grants
-- EXECUTE to PUBLIC by default, so anon/authenticated kept access through
-- the PUBLIC grant (live proacl: {=X/postgres,...}). Revoke from PUBLIC
-- outright and grant only to service_role (the Edge Function admin client)
-- and the owner (postgres). SECURITY DEFINER + owner postgres means
-- postgres can still invoke it.
REVOKE ALL ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_user(UUID, UUID, UUID, TEXT, TEXT, BOOLEAN) TO service_role;

-- ================================================================
-- VERIFICATION (run after apply)
-- ================================================================
-- 1. No PUBLIC exec left:
--      SELECT proacl FROM pg_proc
--      WHERE proname = 'provision_user';
--    Expected: {postgres=X/postgres, service_role=X/postgres} — no '=X/...'.
-- 2. anon/authenticated cannot execute:
--      SELECT has_function_privilege('anon', 'public.provision_user(uuid,uuid,uuid,text,text,boolean)', 'EXECUTE');
--      SELECT has_function_privilege('authenticated', 'public.provision_user(uuid,uuid,uuid,text,text,boolean)', 'EXECUTE');
--    Expected: false, false. service_role: true.
-- 3. Old 5-arg overload gone:
--      SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname='provision_user';
--    Expected: exactly one row: 'p_user_id uuid, p_shop_id uuid, p_invited_by uuid, p_token text, p_target_role text, p_active boolean'
-- 4. Phantom shop re-run safe: DELETE is idempotent (identify → not found → no-op).
