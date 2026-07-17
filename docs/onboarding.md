# User Onboarding & Approval Flow

**Version:** 3.1.0  
**Last updated:** 2026-07-16

---

## Overview

CoffeeShop POS uses a **manual approval model** for new shop registrations. There is no instant access — all signups require review and approval by a Platform Admin before the shop owner can access the POS terminal.

This approach ensures quality control over the shops on the platform and allows Ko Htun (Platform Admin) to verify each business before granting access. The flow is fully implemented and tested as of v3.1.0.

> **Hard Rule (VISION.md §6.4):** "No instant access. All signups require manual approval by `platform_admin`. There is no self-service activation, no automated approval, no 'try before review' flow."

---

## Step-by-Step User Journey

### Step 1: Signup

The shop owner visits the application and fills out the registration form with:

| Field | Required | Description |
|-------|----------|-------------|
| **Name** | ✅ | Owner's full name |
| **Username** | ✅ | Unique username for login |
| **Shop Name** | ✅ | Business name (e.g., "Golden Bean Coffee") |
| **Email** | ✅ | Email address for account |
| **Password** | ✅ | Account password |

On form submission, Supabase Auth creates a new authentication user. The app automatically redirects to the **Pending Approval** page.

### Step 2: Database Trigger

When a new user is created in `auth.users`, the `handle_new_auth_user()` trigger fires and creates rows in three tables:

| Table | Key Columns | Default Values |
|-------|-------------|----------------|
| `public.users` | `id, username, name, email, role, permissions, active` | `role = 'cashier'`, `permissions = ['pos_access']`, **`active = false`** |
| `public.shops` | `name, email, owner_id, is_active, subscription_tier` | **`is_active = false`**, `subscription_tier = 'free'` (schema default) |
| `public.shop_memberships` | `user_id, shop_id, role, is_active` | `role = 'admin'` (shop owner), **`is_active = false`** |

**Important:** The shop owner is automatically assigned the `admin` role in their shop's membership, but they cannot access anything until all three boolean flags are set to `true` by the Platform Admin.

### Step 3: Pending Approval

After signup, the user is redirected to the **Pending Approval** page (`PendingApprovalPage.tsx`). This page displays:

- **Title:** "Pending Approval"
- **Message:** "Your shop registration is pending approval from the platform admin."
- **Next Steps:**
  - Platform admin reviews your registration
  - You'll be notified once approved
  - Then you can start using the POS system
- **Contact Info:** "Questions? Contact Ko Htun via Viber or WhatsApp."

**At this stage, the user cannot:**
- Access the POS terminal
- View products or inventory
- Access any shop features

**The user can:**
- Click "Refresh Status" to check if they've been approved
- Sign out of the application

### Step 4: Platform Admin Review

The Platform Admin (`platform_admin` role) logs in and navigates to **"Pending Shops"** in the Platform Admin dashboard. Here they can:

- View all pending shop registrations
- Review shop details: name, business type, owner email
- Decide to **Approve** or **Reject** the registration

### Step 5: Activation

When the Platform Admin clicks **"Approve"**, the Edge Function (`platform-admin-approve-shop`) performs three database updates using the `service_role` key (bypasses RLS):

```sql
-- 1. Activate the shop
UPDATE shops SET is_active = true, updated_at = NOW() WHERE id = <shop_id>;

-- 2. Activate the shop membership
UPDATE shop_memberships SET is_active = true, updated_at = NOW() 
WHERE id = <membership_id>;

-- 3. Activate the user
UPDATE users SET active = true, updated_at = NOW() 
WHERE id = <user_id>;
```

**Note:** The `subscription_tier` is already set to `'free'` by the database schema default — the approval function does not need to set it explicitly.

The function also records an audit log entry (action: `approve_shop`, target: `shop`).

### Step 6: First Login & POS Access

After approval, the user can log in normally:

1. User enters email and password
2. Auth system verifies credentials
3. Profile loads with `active = true`
4. Shop membership loads with `is_active = true`
5. Shop loads with `is_active = true`
6. User receives the `admin` role for their shop
7. **Full POS access is granted** on the Free tier

The user now has access to all features available at their subscription tier (Free tier by default).

---

## Post-Onboarding: Tier Upgrades

Once a shop is active on the **Free tier**, they can upgrade to **Growth** or **Pro** tiers via the **Manual High-Touch** billing model (VISION.md §3.4).

### How Tier Upgrades Work

1. **User contacts Ko Htun** via Viber or WhatsApp
2. **Payment** is made via KBZpay or MMQR (Myanmar payment methods)
3. **Platform Admin updates the tier** in the dashboard:
   - Navigates to Shop Management
   - Selects the shop
   - Updates subscription tier from Free → Growth or Pro

### Tier Limits

| Feature | Free (0 MMK/mo) | Growth (49,000 MMK/mo) | Pro (149,000 MMK/mo) |
|---------|-----------------|------------------------|----------------------|
| Products | 50 max | Unlimited | Unlimited |
| Daily Orders | 50/day | Unlimited | Unlimited |
| Receipt Printing | ❌ | ✅ | ✅ |
| Purchase Log | ❌ | ✅ | ✅ |
| Cash Drawer / Shifts | ❌ | ✅ | ✅ |
| Simple Profit Report | ❌ | ❌ | ✅ |
| Owner Insights (P&L) | ❌ | ❌ | ✅ |

For a complete tier specification, see [`docs/specs/tier-spec.md`](tier-spec.md).

---

## Troubleshooting / Common Issues

### "Why is my shop pending?"

**Answer:** Your shop registration is awaiting approval from the Platform Admin. This is normal — all new shops require manual review before access is granted. Please wait for Ko Htun to review your application, or contact him via Viber/WhatsApp for status updates.

### "Email not confirmed"

**Answer:** Check your spam folder for the confirmation email from Supabase. If you still don't see it, the Platform Admin can manually confirm your email via the Supabase Dashboard (Authentication → Users → find user → Confirm email).

### "I was approved but still see the pending page"

**Answer:** Click the **"Refresh Status"** button on the Pending Approval page. If you still see the pending page after refreshing, sign out and sign back in. If the issue persists, contact Ko Htun — there may be a synchronization delay.

### "I need to change my shop name or details after signup"

**Answer:** Contact Ko Htun via Viber or WhatsApp. Shop details can be updated by the Platform Admin after approval.

---

## Technical Reference

### Database Tables Involved

| Table | Purpose | Activation Column |
|-------|---------|-------------------|
| `public.users` | User profile (extends auth.users) | `active` |
| `public.shops` | Shop identity and configuration | `is_active` |
| `public.shop_memberships` | User-to-shop role assignments | `is_active` |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `platform-admin-approve-shop` | Activates shop, membership, and user |
| `platform-admin-reject-shop` | Rejects shop registration with reason |
| `platform-admin-update-subscription` | Changes subscription tier |

### Trigger

| Trigger | Fires On | Purpose |
|---------|----------|---------|
| `handle_new_auth_user()` | `AFTER INSERT ON auth.users` | Creates pending user, shop, and membership rows |

---

## Related Documentation

- [VISION.md §6.3](vision/VISION.md) — Manual approval model specification
- [VISION.md §6.4](vision/VISION.md) — No instant access rule
- [tier-spec.md](specs/tier-spec.md) — Tier definitions and capability mapping
- [auth.md](architecture/auth.md) — Authentication flow and role hierarchy
