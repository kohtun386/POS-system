# Auth Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last updated:** 2026-06-23

---

## 1. Auth Flow

### 1.1 Login

```
User enters email + password
    │
    ▼
AuthContext.signIn(email, password)
    │
    ▼
supabase.auth.signInWithPassword()
    │
    ├─ Error → swalConfig.error() with friendly message
    │
    ▼
supabase.auth.onAuthStateChange fires
    │
    ▼
loadProfile(userId)
    │
    ▼
supabase.from('users').select('*').eq('id', userId).single()
    │
    ▼
setProfile({ id, username, name, email, role, permissions, active, ... })
    │
    ▼
App.tsx: user && state.currentUser → render AppContent
    │
    ▼
AppProvider.useEffect triggers loadData()
    │
    ▼
Promise.all([products, customers, sales, discounts, settings, users, salesTabs])
```

### 1.2 Sign Up And Pending Approval

Instant active access after signup is deprecated.

```
User enters email, password, name, username, optional shop name
    │
    ▼
AuthContext.signUp(email, password, name, username)
    │
    ▼
supabase.auth.signUp({ email, password, options: { data: { name, username, shop_name } } })
    │
    ▼
DB trigger: handle_new_auth_user() fires on auth.users INSERT
    │
    ├─ Creates public.users profile with active=false
    ├─ Creates shops row with is_active=false for self-registration
    ├─ Creates shop_memberships row with is_active=false
    │
    ▼
User cannot access POS until approved
    │
    ▼
After sign-in / email verification, frontend shows PendingApprovalScreen
    │
    ▼
Authorized approver activates users.active, shop_memberships.is_active, shops.is_active
    │
    ▼
User can access app data for the active shop
```

**Critical:** Frontend does NOT insert user profiles directly. The trigger creates the profile/shop/membership skeleton, and app access is gated until all approval flags are active.

**Email confirmation:** Supabase may create the `auth.users` row before email confirmation. If email confirmation is enabled, unconfirmed users cannot sign in normally; approval gating is still required after confirmation.

**Self-registration role:** The intended owner of a self-registered shop is a pending shop admin/owner. Existing admins creating staff can assign `cashier`, `manager`, or `admin` through the user-management workflow after the trigger-created profile exists.

### 1.3 Admin Creating New User

```
Admin opens UserManager → UserModal → fills form
    │
    ▼
Save admin session: supabase.auth.getSession()
    │
    ▼
supabase.auth.signUp({ email, password, options: { data: { name, username } } })
    │
    ├─ This REPLACES the current session (admin gets logged out as new user)
    │
    ▼
DB trigger: handle_new_auth_user() creates profile (role='cashier')
    │
    ▼
Restore admin session: supabase.auth.setSession(adminSession)
    │
    ▼
UPDATE public.users SET username, name, role, permissions, active
WHERE id = newUserId
    │
    ▼
dispatch({ type: 'SET_USERS', payload: [...state.users, newUser] })
```

**Why this pattern:** Supabase Auth has no admin "create user" API that doesn't change session. `signUp()` replaces session. Must save/restore.

### 1.4 Sign Out

```
AuthContext.signOut()
    │
    ▼
supabase.auth.signOut()
    │
    ▼
onAuthStateChange fires with session=null
    │
    ▼
AppProvider useEffect: user is null →
    dispatch({ type: 'SET_PRODUCTS', payload: [] })
    dispatch({ type: 'SET_CUSTOMERS', payload: [] })
    ... clear all state ...
    dispatch({ type: 'SET_CURRENT_USER', payload: null })
    setInitialized(false)
```

---

## 2. Role Hierarchy

### 2.1 Three Roles

| Role | Level | Description |
|------|-------|-------------|
| `admin` | 3 (highest) | Full system access. User management. Settings. All reports. |
| `manager` | 2 | POS, transactions, inventory, customers, discounts, reports, settings. No user management. |
| `cashier` | 1 | POS terminal only. Cannot navigate to other views. |

### 2.2 Default Role Assignment

| Creation Path | Default Role | Override |
|---------------|-------------|----------|
| Self-registration via app | pending shop `admin`/owner | Activated only after approval; staff roles assigned separately |
| Admin creates user | `cashier` (trigger) → admin sets via UPDATE | Admin sets role in UserModal |
| Dashboard-created user | pending/default role from trigger | Admin updates and activates after creation |

---

## 3. Permission Matrix

### 3.1 UI Access (Enforced in App.tsx + Header.tsx)

| View | admin | manager | cashier |
|------|-------|---------|---------|
| POS Terminal | ✅ | ✅ | ✅ |
| Transactions | ✅ | ✅ | ❌ (redirect to POS) |
| Inventory | ✅ | ✅ | ❌ (redirect to POS) |
| Customers | ✅ | ✅ | ❌ (redirect to POS) |
| Discounts | ✅ | ✅ | ❌ (redirect to POS) |
| Reports | ✅ | ✅ | ❌ (redirect to POS) |
| Users | ✅ | ❌ (redirect to POS) | ❌ (redirect to POS) |
| Settings | ✅ | ✅ (read-only for some) | ❌ (redirect to POS) |

**Enforcement locations:**
- `App.tsx:renderCurrentView()` — switch on `currentView`, checks `state.currentUser.role`
- `Header.tsx:getNavigationItems()` — filters nav items by role
- Mobile: non-cashiers see `ReportsManager` dashboard instead of POS

### 3.2 Database Access (Enforced by RLS Policies)

| Operation | admin | manager | cashier |
|-----------|-------|---------|---------|
| **Products** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ❌ |
| UPDATE | ✅ | ✅ | ❌ |
| DELETE | ✅ | ✅ | ❌ |
| **Customers** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ❌ |
| UPDATE | ✅ | ✅ | ❌ |
| DELETE | ✅ | ✅ | ❌ |
| **Sales** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ✅ |
| UPDATE | ✅ | ✅ | ❌ |
| DELETE | ✅ | ✅ | ❌ |
| **Discounts** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Users** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT | ✅ | ✅ | ✅ (own profile only via trigger) |
| UPDATE | ✅ (any user) | ❌ | ✅ (self only) |
| DELETE | ❌ (no policy) | ❌ | ❌ |
| **Sales Tabs** | | | |
| SELECT | Own only | Own only | Own only |
| INSERT/UPDATE/DELETE | Own only | Own only | Own only |
| **App Settings** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Categories** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Suppliers** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Product Batches** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Currency Config** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Exchange Rates** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |
| **Exchange Rate History** | | | |
| SELECT | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | ✅ | ✅ | ❌ |

### 3.3 Special Cases

| Case | Rule | Enforced By |
|------|------|-------------|
| `users` self-edit | `auth.uid() = id` | RLS policy |
| `users` admin-edit | `EXISTS (admin user)` | RLS policy |
| `users` self-deactivation | Blocked in UI | `UserManager.tsx` disables toggle for `state.currentUser.id` |
| `users` self-deletion | Blocked in UI | `UserManager.tsx` hides delete button for current user |
| `sales_tabs` isolation | `user_id = auth.uid()` | RLS policy — complete per-user isolation |
| `sales` cashier insert | `auth.role() = 'authenticated'` | RLS policy — all authenticated can insert sales |
| `app_settings` preferences | Read/update preference fields only; store identity lives in `shops` | Service pattern + RLS |
| `settingsService` read-only for cashiers | UI only | `Settings.tsx: canEditSettings = role === 'admin' \|\| role === 'manager'` |

---

## 4. RLS Policy Patterns

All policies now include `shop_id IN (SELECT public.current_shop_ids())` scoping. The `current_shop_ids()` function returns all shop_ids the current user is a member of via `shop_memberships`.

### 4.1 Standard Pattern (Most Tables)

```sql
-- SELECT: shop members
CREATE POLICY "<table> viewable by shop members" ON <table>
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- ALL (INSERT/UPDATE/DELETE): shop admin/manager
CREATE POLICY "<table> write by shop admin/manager" ON <table>
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
```

**Tables using this pattern:** app_settings, categories, suppliers, product_batches, discounts, currency_config, exchange_rates, exchange_rate_history, alert_recipients, alert_templates, alert_configurations, alert_history, notification_service_config

### 4.2 Products/Customers Pattern (Per-Operation)

```sql
-- SELECT: shop members
CREATE POLICY "<table> viewable by shop members" ON <table>
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: separate policies, shop admin/manager
CREATE POLICY "<table> insert by shop admin/manager" ON <table>
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );
-- ... same for UPDATE and DELETE
```

**Tables:** products, customers

### 4.3 Sales Pattern (Cashiers Can Insert)

```sql
-- SELECT: shop members
CREATE POLICY "Sales viewable by shop members" ON sales
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- INSERT: all shop members (cashiers record transactions)
CREATE POLICY "Sales insert by shop members" ON sales
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- UPDATE/DELETE: shop admin/manager only
CREATE POLICY "Sales update by shop admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );
```

### 4.4 Sales Tabs Pattern (User-Scoped + Shop-Scoped)

```sql
-- SELECT: own tabs in own shops
CREATE POLICY "Sales tabs viewable by owner in shop" ON sales_tabs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- ALL: own tabs in own shops
CREATE POLICY "Sales tabs insert by owner in shop" ON sales_tabs
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
    AND shop_id IN (SELECT public.current_shop_ids())
  );
-- Same pattern for UPDATE and DELETE
```

### 4.5 Users Table (Mixed Permissions)

```sql
-- SELECT: shop members
CREATE POLICY "Users viewable by shop members" ON users
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- INSERT: all authenticated (trigger creates profile, this is fallback)
CREATE POLICY "Users insert by authenticated" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: self OR admin
CREATE POLICY "Users update self or admin" ON users
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = id
      OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
    )
  );

-- DELETE: no policy (implicit deny)
```

### 4.6 Shops Pattern (Member-Scoped)

```sql
-- SELECT: members can view own shops
CREATE POLICY "Shops viewable by members" ON shops
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND id IN (SELECT public.current_shop_ids())
  );

-- UPDATE: shop admin only for own shop
CREATE POLICY "Shops update by shop admin" ON shops
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships
      WHERE shop_memberships.user_id = auth.uid()
      AND shop_memberships.shop_id = shops.id
      AND shop_memberships.role = 'admin'
    )
  );

-- INSERT: trusted signup/admin workflow only. A separate platform-admin role is not modeled yet.
CREATE POLICY "Shops insert by platform admin" ON shops
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.shop_id = shops.id  -- Must be their own shop
    )
  );

-- DELETE: trusted admin workflow only. Direct client delete should remain unavailable unless a platform-admin model is explicitly added.
CREATE POLICY "Shops delete by platform admin" ON shops
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

### 4.7 Shop Memberships Pattern

```sql
-- SELECT: members can view own shop's memberships
CREATE POLICY "Shop memberships viewable by shop members" ON shop_memberships
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
  );

-- UPDATE: shop admin only for own shop. INSERT/DELETE require an explicitly modeled platform/admin workflow or trusted server-side function.
CREATE POLICY "Shop memberships write by shop admin" ON shop_memberships
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND shop_id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships sm
      WHERE sm.user_id = auth.uid()
      AND sm.shop_id = shop_memberships.shop_id
      AND sm.role = 'admin'
    )
  );
```

**Note:** The `shop_memberships` INSERT/DELETE operations are intentionally restricted. New memberships for self-registration are created by the `handle_new_auth_user()` SECURITY DEFINER trigger (bypasses RLS). Admin-initiated membership management should use a trusted server-side function or explicit platform-admin workflow.

---

## 5. Helper Functions

### 5.1 `current_shop_ids()` — INVOKER

```sql
CREATE OR REPLACE FUNCTION public.current_shop_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
    SELECT shop_id FROM public.shop_memberships
    WHERE user_id = auth.uid() AND is_active = true;
$$;
```

Returns all shop_ids the current user is an active member of. Used in every RLS policy. INVOKER security — respects RLS on `shop_memberships` itself.

---

## 6. SECURITY DEFINER Functions

Functions that run with owner privileges (bypass RLS). Must be carefully controlled.

| Function | Revoked From | Notes |
|----------|-------------|-------|
| `handle_new_auth_user()` | `anon`, `authenticated` | Trigger-only. Client cannot call via RPC |
| `rls_auto_enable()` | `anon`, `authenticated` | Event trigger. Client cannot call via RPC |

**Guard:** Any new SECURITY DEFINER function MUST have `REVOKE EXECUTE ... FROM anon, authenticated` immediately after creation.

---

## 6. Session Management

| Aspect | Implementation |
|--------|---------------|
| Token storage | Supabase SDK handles via `persistSession: true` |
| Token refresh | `autoRefreshToken: true` in supabase client config |
| Session detection | `detectSessionInUrl: true` for OAuth redirects |
| Session lifetime | Supabase default (1 hour access token, refresh token valid until revoked) |
| Multi-device | Supported — each device gets its own session |
| Concurrent sessions | Supported — no limit enforced at app level |

---

## 7. Security Posture

### 7.1 What's Protected

- All tables have RLS enabled
- Role-aware policies on all tables (not blanket authenticated)
- Card data purged (`cardNumber` stripped from `card_details` and `payments` JSONB)
- `users` not publicly readable (fixed in security audit)
- All functions use `SET search_path = ''` (prevents search-path injection)
- SECURITY DEFINER functions revoked from client roles
- `service_role` key removed from client bundle
- `.env` in `.gitignore`

### 7.2 Known Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| Dynamic shop configuration incomplete | Store identity/POS config still being moved from `app_settings` to `shops` | Dynamic shop configuration spec |
| No audit logging | Can't trace who changed what | activity_log table (planned) |
| Signup abuse risk | Bot signups can create pending shops/users | Email confirmation, CAPTCHA, Supabase rate limits, optional signup Edge Function limiter |
| No MFA | Admin accounts vulnerable | Supabase Dashboard → Auth → MFA (manual) |
| `users` DELETE blocked | Can't remove users via app | Intentional — use `active=false` soft delete |
| Leaked password protection | Must enable manually | Supabase Dashboard → Auth → Settings (manual) |
| No session invalidation | User stays logged in after role/approval change | Re-login or refresh required; no real-time role push |
| `users` UPDATE: manager can't edit others | Only admin can update other users | UI hides edit for non-admin managers; RLS blocks |

---

## 8. JWT Claims Available

Supabase JWT includes:

| Claim | Type | Source | Usage |
|-------|------|--------|-------|
| `sub` | uuid | `auth.users.id` | `auth.uid()` in RLS |
| `role` | string | Always `'authenticated'` for app users | `auth.role()` in RLS |
| `email` | string | `auth.users.email` | Available in `user.email` |
| `user_metadata` | object | Passed at signUp | `name`, `username` |

**Not in JWT:** `users.role` (admin/manager/cashier), `users.permissions`. These are in `public.users` table. RLS policies query `users` table for role check.

**Implication:** Every role-checking RLS policy does a subquery: `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ...)`. This is a performance consideration for high-traffic tables.
