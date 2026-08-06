-- ================================================================
-- FIX: Add staff_accounts capability gate to users INSERT policy
-- ================================================================
-- G1 finding: The "Users insert self only" policy only checks
-- auth.role() = 'authenticated'. While it already pins id = auth.uid()
-- and role = 'cashier' (preventing privilege escalation), it lacks
-- an explicit capability gate. Free-tier admins could theoretically
-- insert users without the staff_accounts capability.
--
-- This migration adds a SECOND INSERT policy for admin/manager user
-- creation that checks has_capability(shop_id, 'staff_accounts').
-- The self-insert policy is preserved for signup flows.
--
-- PostgreSQL applies INSERT policies with OR logic: if ANY policy
-- matches, the INSERT succeeds. Both policies coexist safely.
--
-- Pattern: follows capability_gate_remaining_tables.sql (20260802050000)
-- ================================================================

-- 1. Keep existing self-insert policy for signup (role='cashier', active=false)
DROP POLICY IF EXISTS "Users insert self only" ON public.users;

CREATE POLICY "Users insert self only" ON public.users
    FOR INSERT TO public
    WITH CHECK (
        auth.role() = 'authenticated'
        AND id = auth.uid()
        AND role = 'cashier'
        AND active = false
    );

-- 2. Add admin/manager user creation gated by staff_accounts capability
--    Caller must be admin/manager in a shop that has staff_accounts.
--    current_shop_ids() returns the caller's memberships, not the row's.
DROP POLICY IF EXISTS "Users insert by shop admin with staff_accounts" ON public.users;

CREATE POLICY "Users insert by shop admin with staff_accounts" ON public.users
    FOR INSERT TO public
    WITH CHECK (
        auth.role() = 'authenticated'
        AND shop_id IN (SELECT current_shop_ids())
        AND public.has_capability(shop_id, 'staff_accounts')
        AND EXISTS (
            SELECT 1 FROM shop_memberships sm
            WHERE sm.user_id = auth.uid()
              AND sm.shop_id = users.shop_id
              AND sm.role IN ('admin', 'manager')
              AND sm.is_active = true
        )
    );

-- ================================================================
-- VERIFICATION
-- ================================================================
-- 1. Self-insert with role='cashier', active=false  -> ALLOWED (signup)
-- 2. Growth admin inserts user in their shop          -> ALLOWED (has capability)
-- 3. Free admin inserts user in their shop            -> BLOCKED (no capability)
-- 4. Cashier inserts user                             -> BLOCKED (no admin/manager role)
-- 5. Cross-tenant insert                              -> BLOCKED (not in target shop)
