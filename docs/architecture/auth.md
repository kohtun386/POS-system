# Auth Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last updated:** 2026-06-19

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

### 1.2 Sign Up

```
User enters email, password, name, username
    │
    ▼
AuthContext.signUp(email, password, name, username)
    │
    ▼
supabase.auth.signUp({ email, password, options: { data: { name, username } } })
    │
    ▼
DB trigger: handle_new_auth_user() fires on auth.users INSERT
    │
    ├─ Extracts username from raw_user_meta_data → username
    ├─ Extracts name from raw_user_meta_data → name
    ├─ Fallback: email prefix for both
    │
    ▼
INSERT INTO public.users (id, username, name, email, role='cashier', permissions=['pos_access'], active=true)
    │
    ▼
Frontend fetches trigger-created profile:
    supabase.from('users').select('*').eq('id', userId).single()
    │
    ▼
setProfile(trigger-created row)
```

**Critical:** Frontend does NOT insert user profile. Trigger handles it. Frontend then UPDATES if admin changes role.

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
| Sign up via app | `cashier` | Admin can update via UserManager |
| Admin creates user | `cashier` (trigger) → admin sets via UPDATE | Admin sets role in UserModal |
| Dashboard-created user | `cashier` (trigger fallback) | Admin updates after creation |

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
| `app_settings` single-row | `SELECT * LIMIT 1` | Service pattern, not RLS |
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

-- ALL: shop admin only
CREATE POLICY "Shops write by shop admin" ON shops
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND id IN (SELECT public.current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM public.shop_memberships
      WHERE shop_memberships.user_id = auth.uid()
      AND shop_memberships.shop_id = shops.id
      AND shop_memberships.role = 'admin'
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

-- ALL: shop admin only
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
| No tenant isolation | Any authenticated user sees all data | shop_id migration (planned) |
| No audit logging | Can't trace who changed what | activity_log table (planned) |
| No rate limiting | Brute force on login | Supabase Dashboard → Auth → Rate Limits (manual) |
| No MFA | Admin accounts vulnerable | Supabase Dashboard → Auth → MFA (manual) |
| `users` DELETE blocked | Can't remove users via app | Intentional — use `active=false` soft delete |
| Leaked password protection | Must enable manually | Supabase Dashboard → Auth → Settings (manual) |
| No session invalidation | User stays logged in after role change | Re-login required; no real-time role push |
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
