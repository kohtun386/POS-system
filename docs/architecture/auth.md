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

### 4.1 Standard Pattern (Most Tables)

```sql
-- SELECT: all authenticated users
CREATE POLICY "<table> viewable by all authenticated" ON <table>
  FOR SELECT USING (auth.role() = 'authenticated');

-- ALL (INSERT/UPDATE/DELETE): admin/manager only
CREATE POLICY "<table> write by admin/manager" ON <table>
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
```

**Tables using this pattern:** app_settings, categories, customers, suppliers, products, product_batches, discounts, currency_config, exchange_rates, exchange_rate_history

### 4.2 Sales Pattern (Cashiers Can Insert)

```sql
-- SELECT: all authenticated
CREATE POLICY "Sales viewable by all authenticated" ON sales
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: all authenticated (cashiers record transactions)
CREATE POLICY "Sales insert by all authenticated" ON sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: admin/manager only
CREATE POLICY "Sales update by admin/manager" ON sales
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- DELETE: admin/manager only
CREATE POLICY "Sales delete by admin/manager" ON sales
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );
```

### 4.3 Sales Tabs Pattern (User-Scoped)

```sql
-- SELECT: own tabs only
CREATE POLICY "Users can view their own sales tabs" ON sales_tabs
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );

-- ALL: own tabs only
CREATE POLICY "Users can manage their own sales tabs" ON sales_tabs
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND user_id = auth.uid()
  );
```

### 4.4 Users Table (Mixed Permissions)

```sql
-- SELECT: all authenticated
CREATE POLICY "Users viewable by authenticated users" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: all authenticated (trigger creates profile, this is fallback)
CREATE POLICY "Users insert by authenticated users" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: self OR admin
CREATE POLICY "Users can update their own profile or admins can update any" ON users
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND (
      auth.uid() = id
      OR EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
      )
    )
  );

-- DELETE: no policy (implicit deny)
```

---

## 5. SECURITY DEFINER Functions

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
