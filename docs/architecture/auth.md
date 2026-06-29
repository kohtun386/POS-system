# Auth Architecture — CoffeeShop POS

**Supabase project:** `ejvvwnupiqytximrbmfw`
**Last updated:** 2026-06-29 (aligned with VISION.md v3.0.0)

---

## 1. Authentication Policy

### 1.1 Primary Method: Email + Password

**What:** Email + password is the canonical authentication method.

**Why:** Shop ownership must not be tied to a personal Google account. Email-based auth ensures:
- Shop account is independent of personal accounts
- Ownership transfer is possible (change email)
- No dependency on third-party OAuth availability

### 1.2 Optional Method: Google OAuth

**What:** Google OAuth available as a convenience "Sign in with Google" option. Not primary.

**Why:** Still creates an email-based account (uses Google email). Owner can later add a password and sign in without Google.

### 1.3 No Instant Access (Manual Approval Required)

**What:** All signups require manual approval by `platform_admin`. No self-service activation, no automated approval, no "try before review" flow.

**Why:** Quality control. Ko Htun reviews every shop before activation. Prevents spam, ensures correct setup, enables personal onboarding relationship.

---

## 2. Auth Flow

### 2.1 Login

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

### 2.2 Sign Up And Pending Approval

```
User enters email, password, name, username, shop name
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
    ├─ Creates public.users row (active=false)
    ├─ Creates shops row (is_active=false, business_type='coffee_shop',
    │   subscription_tier='free', daily_order_limit=50)
    ├─ Creates shop_memberships row (role='admin', is_active=false)
    │
    ▼
User cannot access POS until approved
    │
    ▼
After sign-in / email verification, frontend shows PendingApprovalScreen
    │
    ▼
platform_admin reviews in Platform Admin UI
    │
    ├─ Approve → Edge Function activates users.active,
    │   shop_memberships.is_active, shops.is_active
    │   Email notification: "Your shop has been approved!"
    │
    ├─ Reject → Edge Function sends rejection email with reason
    │   Shop remains inactive
    │
    ▼
User can access app data for the active shop
```

**Critical:** Frontend does NOT insert user profiles directly. The trigger creates the profile/shop/membership skeleton, and app access is gated until all approval flags are active.

**Email confirmation:** Supabase may create the `auth.users` row before email confirmation. If email confirmation is enabled, unconfirmed users cannot sign in normally; approval gating is still required after confirmation.

**Self-registration role:** The intended owner of a self-registered shop is a pending shop admin/owner. Existing admins creating staff can assign `cashier`, `manager`, or `admin` through the user-management workflow after the trigger-created profile exists.

### 2.3 Admin Creating New User

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

### 2.4 Sign Out

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

## 3. Role Hierarchy

### 3.1 Four Roles

| Role | Scope | Level | Description |
|------|-------|-------|-------------|
| `platform_admin` | Cross-tenant | 4 (highest) | Platform operator (Ko Htun). Manages all shops, approves signups, activates subscriptions. No shop_memberships row. Operates via Edge Functions with `service_role` key. |
| `admin` | Per-shop | 3 | Shop owner. Full access to their shop's features, settings, and staff. |
| `manager` | Per-shop | 2 | Shift supervisor. POS, inventory, reports, customer management. No user management or shop settings. |
| `cashier` | Per-shop | 1 | Barista/staff. POS terminal only. |

### 3.2 platform_admin Specifics

- **No shop_memberships row:** `platform_admin` does not have entries in `shop_memberships`. They operate cross-tenant.
- **No RLS bypass in policies:** RLS policies do NOT contain `OR users.role = 'platform_admin'`. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions.
- **All operations via Edge Functions:** Every platform admin action routes through Supabase Edge Functions using the `service_role` key. Zero direct database access from the platform admin UI.

### 3.3 Default Role Assignment

| Creation Path | Default Role | Override |
|---------------|-------------|----------|
| Self-registration via app | pending shop `admin`/owner | Activated only after approval; staff roles assigned separately |
| Admin creates user | `cashier` (trigger) → admin sets via UPDATE | Admin sets role in UserModal |
| Dashboard-created user | pending/default role from trigger | Admin updates and activates after creation |

### 3.4 `users.role` Status

`users.role` is retained for backward compatibility. The canonical role source is `shop_memberships.role`. The `platform_admin` role does NOT have a `shop_memberships` row — it operates cross-tenant via Edge Functions with `service_role` key.

---

## 4. Permission Matrix

### 4.1 UI Access (Enforced in App.tsx + Header.tsx)

| View | platform_admin | admin | manager | cashier |
|------|:-:|:-:|:-:|:-:|
| Platform Admin UI | ✅ | ❌ | ❌ | ❌ |
| POS Terminal | ❌ | ✅ | ✅ | ✅ |
| Transactions | ❌ | ✅ | ✅ | ❌ (redirect to POS) |
| Inventory | ❌ | ✅ | ✅ | ❌ (redirect to POS) |
| Customers | ❌ | ✅ | ✅ | ❌ (redirect to POS) |
| Discounts | ❌ | ✅ | ✅ | ❌ (redirect to POS) |
| Reports | ❌ | ✅ | ✅ | ❌ (redirect to POS) |
| Owner Insights | ❌ | ✅ | ❌ | ❌ (redirect to POS) |
| Users | ❌ | ✅ | ❌ (redirect to POS) | ❌ (redirect to POS) |
| Settings | ❌ | ✅ | ✅ (read-only for some) | ❌ (redirect to POS) |

**Enforcement locations:**
- `App.tsx:renderCurrentView()` — switch on `currentView`, checks `state.currentUser.role`
- `Header.tsx:getNavigationItems()` — filters nav items by role
- Mobile: non-cashiers see `ReportsManager` dashboard instead of POS
- Platform admin: separate component tree under `src/components/platform/`, only accessible to `platform_admin` role

### 4.2 Database Access (Enforced by RLS Policies)

| Operation | platform_admin | admin | manager | cashier |
|-----------|:-:|:-:|:-:|:-:|
| **Products** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | ✅ | ✅ | ❌ |
| UPDATE | Edge Function | ✅ | ✅ | ❌ |
| DELETE | Edge Function | ✅ | ✅ | ❌ |
| **Customers** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | ✅ | ✅ | ❌ |
| UPDATE | Edge Function | ✅ | ✅ | ❌ |
| DELETE | Edge Function | ✅ | ✅ | ❌ |
| **Sales** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | ✅ | ✅ | ✅ |
| UPDATE | Edge Function | ✅ | ✅ | ❌ |
| DELETE | Edge Function | ✅ | ✅ | ❌ |
| **Discounts** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | Edge Function | ✅ | ✅ | ❌ |
| **Users** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | ✅ | ✅ | ✅ (own profile only via trigger) |
| UPDATE | Edge Function | ✅ (any user) | ❌ | ✅ (self only) |
| DELETE | Edge Function | ❌ (no policy) | ❌ | ❌ |
| **Sales Tabs** | | | | |
| SELECT | Edge Function | Own only | Own only | Own only |
| INSERT/UPDATE/DELETE | Edge Function | Own only | Own only | Own only |
| **Feature Definitions** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | Edge Function only | ❌ | ❌ | ❌ |
| **Shop Features** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | Edge Function | ✅ (admin only) | ❌ | ❌ |
| **Recipes / Recipe Items** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT/UPDATE/DELETE | Edge Function | ✅ | ✅ | ❌ |
| **Consumption Log** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | RPC only | RPC only | RPC only |
| **Print Jobs** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | RPC only | RPC only | RPC only |
| UPDATE | Edge Function | Edge Function | Edge Function | Edge Function |
| **Cash Shifts** | | | | |
| SELECT | Edge Function | ✅ | ✅ | ✅ |
| INSERT | Edge Function | ✅ | ✅ | ✅ (own shifts) |
| UPDATE | Edge Function | ✅ | ✅ | ✅ (own shifts) |
| **Shops** | | | | |
| SELECT | Edge Function | ✅ (own shop) | ✅ (own shop) | ✅ (own shop) |
| INSERT/UPDATE/DELETE | Edge Function only | ❌ | ❌ | ❌ |
| **Shop Memberships** | | | | |
| SELECT | Edge Function | ✅ (own shop) | ✅ (own shop) | ✅ (own shop) |
| INSERT/UPDATE/DELETE | Edge Function only | ❌ | ❌ | ❌ |

**Note:** `platform_admin` accesses all tables via Edge Functions with `service_role` key (bypasses RLS). The "Edge Function" entries indicate the platform admin never hits RLS policies directly.

### 4.3 Special Cases

| Case | Rule | Enforced By |
|------|------|-------------|
| `users` self-edit | `auth.uid() = id` | RLS policy |
| `users` admin-edit | `EXISTS (admin user)` | RLS policy |
| `users` self-deactivation | Blocked in UI | `UserManager.tsx` disables toggle for `state.currentUser.id` |
| `users` self-deletion | Blocked in UI | `UserManager.tsx` hides delete button for current user |
| `sales_tabs` isolation | `user_id = auth.uid()` | RLS policy — complete per-user isolation |
| `sales` cashier insert | `auth.role() = 'authenticated'` | RLS policy — all authenticated can insert sales |
| `consumption_log` insert | RPC only | `checkout_complete()` RPC (SECURITY DEFINER) |
| `print_jobs` insert | RPC only | `checkout_complete()` RPC |
| `print_jobs` update | Edge Function only | pg_cron worker via Edge Function |
| `feature_definitions` write | Edge Function only | `platform_admin` via Edge Function |
| `shops` write | Edge Function only | `platform_admin` via Edge Function |
| `shop_memberships` write | Edge Function only | `platform_admin` via Edge Function |
| `app_settings` preferences | Read/update preference fields only; store identity lives in `shops` | Service pattern + RLS |
| `settingsService` read-only for cashiers | UI only | `Settings.tsx: canEditSettings = role === 'admin' \|\| role === 'manager'` |

---

## 5. RLS Policy Patterns

All policies include `shop_id = ANY(current_shop_ids())` scoping. The `current_shop_ids()` function returns all shop_ids the current user is a member of via `shop_memberships`.

**`platform_admin` rule:** NEVER appears in RLS policies. Platform admin bypasses RLS entirely via `service_role` key in Edge Functions. No `OR users.role = 'platform_admin'` in any policy.

### 5.1 Standard Pattern (Most Tables)

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON <table>
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: shop admin/manager
CREATE POLICY "shop_admin_write" ON <table>
  FOR INSERT WITH CHECK (
    shop_id = ANY(current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE user_id = auth.uid()
        AND shop_id = <table>.shop_id
        AND role IN ('admin', 'manager')
        AND is_active = true
    )
  );
```

**Tables using this pattern:** app_settings, categories, suppliers, product_batches, discounts, currency_config, exchange_rates, exchange_rate_history, alert_recipients, alert_templates, alert_configurations, alert_history, notification_service_config, recipes, recipe_items

### 5.2 Products/Customers Pattern (Per-Operation)

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON <table>
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: separate policies, shop admin/manager
CREATE POLICY "shop_admin_insert" ON <table>
  FOR INSERT WITH CHECK (
    shop_id = ANY(current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE user_id = auth.uid()
        AND shop_id = <table>.shop_id
        AND role IN ('admin', 'manager')
        AND is_active = true
    )
  );
-- ... same for UPDATE and DELETE
```

**Tables:** products, customers

### 5.3 Sales Pattern (Cashiers Can Insert)

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON sales
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT: all shop members (cashiers record transactions)
CREATE POLICY "shop_member_insert" ON sales
  FOR INSERT WITH CHECK (
    shop_id = ANY(current_shop_ids())
  );

-- UPDATE/DELETE: shop admin/manager only
CREATE POLICY "shop_admin_update" ON sales
  FOR UPDATE USING (
    shop_id = ANY(current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE user_id = auth.uid()
        AND shop_id = sales.shop_id
        AND role IN ('admin', 'manager')
        AND is_active = true
    )
  );
```

### 5.4 Sales Tabs Pattern (User-Scoped + Shop-Scoped)

```sql
-- SELECT: own tabs in own shops
CREATE POLICY "own_tabs_select" ON sales_tabs
  FOR SELECT USING (
    user_id = auth.uid()
    AND shop_id = ANY(current_shop_ids())
  );

-- ALL: own tabs in own shops
CREATE POLICY "own_tabs_insert" ON sales_tabs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND shop_id = ANY(current_shop_ids())
  );
-- Same pattern for UPDATE and DELETE
```

### 5.5 Users Table (Mixed Permissions)

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON users
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT: all authenticated (trigger creates profile, this is fallback)
CREATE POLICY "authenticated_insert" ON users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: self OR admin
CREATE POLICY "self_or_admin_update" ON users
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  );

-- DELETE: no policy (implicit deny)
```

### 5.6 Shops Pattern (Member-Scoped)

```sql
-- SELECT: members can view own shops
CREATE POLICY "member_select" ON shops
  FOR SELECT USING (
    id = ANY(current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: platform_admin only via Edge Function
-- No RLS policy — platform_admin bypasses RLS via service_role key
-- Direct client writes are blocked (implicit deny)
```

**Note:** Shops INSERT/UPDATE/DELETE are managed exclusively by `platform_admin` via Edge Functions. No RLS policies needed — the `service_role` key bypasses RLS.

### 5.7 Shop Memberships Pattern

```sql
-- SELECT: members can view own shop's memberships
CREATE POLICY "shop_member_select" ON shop_memberships
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: platform_admin only via Edge Function
-- No RLS policy — platform_admin bypasses RLS via service_role key
-- New memberships for self-registration created by handle_new_auth_user() SECURITY DEFINER trigger
```

**Note:** Shop memberships INSERT/UPDATE/DELETE are managed exclusively by `platform_admin` via Edge Functions. The `handle_new_auth_user()` trigger creates the initial membership on signup (bypasses RLS as SECURITY DEFINER).

### 5.8 Feature Definitions Pattern (Platform Admin Only)

```sql
-- SELECT: all authenticated (features are public knowledge)
CREATE POLICY "authenticated_select" ON feature_definitions
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT/UPDATE/DELETE: platform_admin only via Edge Function
-- No RLS policy — platform_admin bypasses RLS via service_role key
```

### 5.9 Shop Features Pattern

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON shop_features
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT/UPDATE/DELETE: shop admin only
CREATE POLICY "shop_admin_write" ON shop_features
  FOR INSERT WITH CHECK (
    shop_id = ANY(current_shop_ids())
    AND EXISTS (
      SELECT 1 FROM shop_memberships
      WHERE user_id = auth.uid()
        AND shop_id = shop_features.shop_id
        AND role = 'admin'
        AND is_active = true
    )
  );
```

### 5.10 Consumption Log Pattern (RPC Only)

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON consumption_log
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT: via checkout_complete RPC only (SECURITY DEFINER)
-- No direct client INSERT policy
```

### 5.11 Print Jobs Pattern

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON print_jobs
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT: via checkout_complete RPC (SECURITY DEFINER)
-- UPDATE: via Edge Function (pg_cron worker)
-- No direct client INSERT/UPDATE policy
```

### 5.12 Cash Shifts Pattern

```sql
-- SELECT: shop members
CREATE POLICY "shop_member_select" ON cash_shifts
  FOR SELECT USING (
    shop_id = ANY(current_shop_ids())
  );

-- INSERT: cashier+ (own shifts), admin/manager (all shifts)
CREATE POLICY "cashier_insert" ON cash_shifts
  FOR INSERT WITH CHECK (
    shop_id = ANY(current_shop_ids())
    AND (
      cashier_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM shop_memberships
        WHERE user_id = auth.uid()
          AND shop_id = cash_shifts.shop_id
          AND role IN ('admin', 'manager')
          AND is_active = true
      )
    )
  );

-- UPDATE: cashier+ (own shifts), admin/manager (all shifts)
CREATE POLICY "cashier_update" ON cash_shifts
  FOR UPDATE USING (
    shop_id = ANY(current_shop_ids())
    AND (
      cashier_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM shop_memberships
        WHERE user_id = auth.uid()
          AND shop_id = cash_shifts.shop_id
          AND role IN ('admin', 'manager')
          AND is_active = true
      )
    )
  );
```

---

## 6. Helper Functions

### 6.1 `current_shop_ids()` — INVOKER

```sql
CREATE OR REPLACE FUNCTION public.current_shop_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
    SELECT COALESCE(ARRAY_AGG(shop_id), '{}')
    FROM public.shop_memberships
    WHERE user_id = auth.uid() AND is_active = true;
$$;
```

Returns array of shop_ids the current user is an active member of. Used in every RLS policy. INVOKER security — respects RLS on `shop_memberships` itself.

**Note:** Returns `uuid[]` (not `SETOF uuid`) for use with `= ANY(current_shop_ids())` pattern.

---

## 7. SECURITY DEFINER Functions

Functions that run with owner privileges (bypass RLS). Must be carefully controlled.

| Function | Revoked From | Notes |
|----------|-------------|-------|
| `handle_new_auth_user()` | `anon`, `authenticated` | Trigger-only. Client cannot call via RPC. Creates user + shop + membership on signup. |
| `rls_auto_enable()` | `anon`, `authenticated` | Event trigger. Client cannot call via RPC |
| `checkout_complete()` | None (INVOKER) | Called via `supabase.rpc()`. Uses `search_path=''`. Contains `SELECT ... FOR UPDATE` for race condition protection. |

**Guard:** Any new SECURITY DEFINER function MUST have `REVOKE EXECUTE ... FROM anon, authenticated` immediately after creation.

---

## 8. Session Management

| Aspect | Implementation |
|--------|---------------|
| Token storage | Supabase SDK handles via `persistSession: true` |
| Token refresh | `autoRefreshToken: true` in supabase client config |
| Session detection | `detectSessionInUrl: true` for OAuth redirects |
| Session lifetime | Supabase default (1 hour access token, refresh token valid until revoked) |
| Multi-device | Supported — each device gets its own session |
| Concurrent sessions | Supported — no limit enforced at app level |

---

## 9. Security Posture

### 9.1 What's Protected

- All tables have RLS enabled
- Role-aware policies on all tables (not blanket authenticated)
- `platform_admin` never appears in RLS policies — bypasses via `service_role` key in Edge Functions
- Card data purged (`cardNumber` stripped from `card_details` and `payments` JSONB)
- `users` not publicly readable (fixed in security audit)
- All functions use `SET search_path = ''` (prevents search-path injection)
- SECURITY DEFINER functions revoked from client roles
- `service_role` key removed from client bundle
- `.env` in `.gitignore`
- Checkout uses `SELECT ... FOR UPDATE` for race condition protection
- Daily order limit enforced server-side in `checkout_complete` RPC

### 9.2 Known Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| No audit logging | Can't trace who changed what | activity_log table (planned) |
| Signup abuse risk | Bot signups can create pending shops/users | Email confirmation, CAPTCHA, Supabase rate limits, optional signup Edge Function limiter |
| No MFA | Admin accounts vulnerable | Supabase Dashboard → Auth → MFA (manual) |
| `users` DELETE blocked | Can't remove users via app | Intentional — use `active=false` soft delete |
| Leaked password protection | Must enable manually | Supabase Dashboard → Auth → Settings (manual) |
| No session invalidation | User stays logged in after role/approval change | Re-login or refresh required; no real-time role push |
| `users` UPDATE: manager can't edit others | Only admin can update other users | UI hides edit for non-admin managers; RLS blocks |

---

## 10. JWT Claims Available

Supabase JWT includes:

| Claim | Type | Source | Usage |
|-------|------|--------|-------|
| `sub` | uuid | `auth.users.id` | `auth.uid()` in RLS |
| `role` | string | Always `'authenticated'` for app users | `auth.role()` in RLS |
| `email` | string | `auth.users.email` | Available in `user.email` |
| `user_metadata` | object | Passed at signUp | `name`, `username` |

**Not in JWT:** `users.role` (platform_admin/admin/manager/cashier), `users.permissions`. These are in `public.users` table. RLS policies query `shop_memberships` table for role check via `current_shop_ids()`.

**Implication:** Role-checking RLS policies use `EXISTS (SELECT 1 FROM shop_memberships WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true)`. The `current_shop_ids()` function is called in every policy for shop scoping.
