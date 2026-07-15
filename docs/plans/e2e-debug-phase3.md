# Root Cause Analysis & Fix Plan — E2E Test Failures (Phase 3)

## Executive Summary

All 9 failures stem from **two root causes**:
1. **The `test-admin` user has `role = 'platform_admin'`** — which renders `PlatformLayout`, not the normal POS nav
2. **`TEST_ADMIN_MANAGER` doesn't exist in the DB** — only `test-admin` was seeded

No 403 permission errors remain. The `service_role` GRANT fix worked.

---

## Root Cause #1: Platform Admin Role Breaks POS Navigation

### Evidence
- `test-admin@coffeeshop.local` → `role = 'platform_admin'` (confirmed in DB)
- `App.tsx:52` — `if (profile?.role === 'platform_admin') return <PlatformLayout />`
- `Header.tsx:70-87` — "Purchases" and "Stock" buttons require `role === 'admin' || role === 'manager'`
- `Header.tsx:100-102` — "Reports" button requires `role === 'admin' || role === 'manager'`

### What Happens
1. `test-admin` logs in → App renders `PlatformLayout` (a completely different component tree)
2. `PlatformLayout` has NO POS nav buttons — it's a platform admin dashboard
3. Tests looking for `nav button` with "Purchases", "Stock", "Reports" → element not found
4. Test 1.1 looks for `text=POS` → not visible in PlatformLayout

### Affected Tests
- **Test 1.1** — Login succeeds but `PlatformLayout` renders instead of POS → `text=POS` not visible
- **Tests 3.1-3.3** — `tierPage` uses `TEST_ADMIN_MANAGER` which doesn't exist → login fails → nav buttons missing
- **Tests 4.1-4.3, 5.1-5.2** — Same issue as 3.x

---

## Root Cause #2: TEST_ADMIN_MANAGER Doesn't Exist

### Evidence
- `tests/e2e/helpers/test-users.ts:17-19` defines `TEST_ADMIN_MANAGER` with email `test-admin-manager@coffeeshop.local`
- `supabase/seed.sql` only creates ONE user: `test-admin@coffeeshop.local` (platform_admin)
- DB query confirms: only 1 row in `public.users` with `email LIKE 'test-%'`
- The `tierPage` fixture calls `loginViaUI(page, TEST_ADMIN_MANAGER.email, ...)` — this user doesn't exist

### What Happens
1. `tierPage` fixture intercepts `resolve_capabilities` RPC (works)
2. Calls `loginViaUI` with non-existent credentials → login fails silently
3. App stays on login page or shows error
4. Nav buttons never render

---

## Fix Plan

### Fix 1: Create a Non-Platform-Admin Test User (seed.sql)

Add a second test user with `role = 'admin'` (not `platform_admin`) to `supabase/seed.sql`:

```sql
-- E2E test admin with normal admin role (not platform_admin)
-- Used by tierPage fixture for POS navigation tests
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  'c2dd8899-3e42-4f7a-ae8e-8cc9cf001122',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'test-admin-manager@coffeeshop.local',
  crypt('TestAdmin123!', gen_salt('bf')),
  now(), now(), now(), '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, name, email, role, permissions, active, shop_id)
VALUES (
  'c2dd8899-3e42-4f7a-ae8e-8cc9cf001122',
  'test_admin_manager',
  'Test Admin Manager',
  'test-admin-manager@coffeeshop.local',
  'admin',
  ARRAY['all']::text[],
  true,
  '4f3dab19-144e-4a29-95a5-2ee82f160ce5'
)
ON CONFLICT (id) DO NOTHING;
```

**Why `admin` role:** Header.tsx checks `role === 'admin' || role === 'manager'` for nav buttons. `admin` gives full nav access.

### Fix 2: Reset Local DB to Pick Up New Seed

```bash
npx supabase db reset --local
```

### Fix 3: Verify Test 1.1 Selector

The `loginViaUI` function fills `input[type="email"]` which exists at `LoginPage.tsx:108`. The test 1.1 failure is NOT a selector issue — it's that after login, `PlatformLayout` renders (no `text=POS`). With the correct user (non-platform-admin), the login should work and show the POS layout.

**If login still times out:** The issue might be that `test-admin` (platform_admin) is the one being used. Test 1.1 uses `TEST_ADMIN` (platform_admin) directly. Options:
- **Option A:** Change test 1.1 to use `TEST_ADMIN_MANAGER` instead
- **Option B:** Keep test 1.1 testing platform_admin login but adjust the assertion to check for PlatformLayout elements instead of `text=POS`
- **Recommended: Option B** — test 1.1 should verify that platform_admin sees PlatformLayout, not POS

### Fix 4: Update Test 1.1 Assertion

Change test 1.1 to verify platform admin sees their dashboard:

```typescript
// Before (broken):
await expect(page.locator('text=POS').first()).toBeVisible({ timeout: 10000 })

// After (correct):
await expect(page.locator('text=Platform').first()).toBeVisible({ timeout: 10000 })
// OR verify URL changed away from login:
expect(page.url()).not.toContain('/login')
```

### Fix 5: Verify Tier-Gated Tests Use Correct User

The `tierPage` fixture in `fixtures.ts:41` already uses `TEST_ADMIN_MANAGER`. Once that user exists in the DB (Fix 1), the fixture will work correctly.

**Verify:** `TEST_ADMIN_MANAGER` has `role = 'admin'` → Header.tsx renders nav → `useCapability('purchase_log')` checks pass (capabilities come from `resolve_capabilities` RPC, which is intercepted by the fixture).

---

## Verification Steps

1. `npx supabase db reset --local` — applies seed with new user
2. `npx vitest run` — unit tests still pass (44/44)
3. `npm run test:e2e` — all 14 tests should pass
4. Specifically check:
   - Test 1.1: Platform admin sees PlatformLayout (or adjust assertion)
   - Test 1.2: Invalid credentials show error
   - Test 1.3: MMK currency check works
   - Tests 2.1-2.3: POS navigation works
   - Tests 3.1-3.3: Tier gating works (free → growth → pro)
   - Tests 4.1-4.3: Inventory CRUD works with growth tier
   - Tests 5.1-5.2: Simple Profit Report works with pro tier

---

## Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `supabase/seed.sql` | Add `test-admin-manager@coffeeshop.local` user with `role='admin'` | DB seed |
| `tests/e2e/journeys/01-auth.spec.ts` | Fix test 1.1 assertion for platform_admin user | Test file |

## Files NOT Modified

- `Header.tsx` — role logic is correct (platform_admin shouldn't see POS nav)
- `App.tsx` — routing logic is correct (platform_admin → PlatformLayout)
- `SupabaseAppContext.tsx` — capability resolution works correctly
- `fixtures.ts` — tierPage fixture is correct (just needs the user to exist)
- `tier-helpers.ts` — capability interception works correctly
