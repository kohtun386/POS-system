# Plan: Platform Admin Scope Alignment (Layers 2 & 4) + Phantom Shop Cleanup

## Context (from prior analysis)

| Layer | Status | Description |
|-------|--------|-------------|
| Layer 1 (P0) | ✅ Fixed in `5f2cbfd` | Phantom shop bug + RLS tier check |
| Layer 2 (P2) | **← This plan** | Deprecate user-management Edge Functions (VISION.md §4.4 violation) |
| Layer 4 (P3) | **← This plan** | Remove "Users" tab from PlatformLayout (VISION.md §4.4 violation) |

Plus: **Phantom shop DB cleanup** — delete orphan shops from old broken trigger.

---

## Step 1: Database Cleanup — Phantom Shops

**File:** `supabase/migrations/20260724000001_cleanup_phantom_shops.sql`

Use a CTE to safely delete shops with 0 products, 0 sales, 0 members (excluding seed shop):

```sql
WITH phantom_shops AS (
    SELECT s.id
    FROM shops s
    WHERE s.id != '4f3dab19-144e-4a29-95a5-2ee82f160ce5'
      AND (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) = 0
      AND (SELECT COUNT(*) FROM sales sa WHERE sa.shop_id = s.id) = 0
      AND (SELECT COUNT(*) FROM shop_memberships sm WHERE sm.shop_id = s.id) = 0
),
deleted_settings AS (
    DELETE FROM app_settings WHERE shop_id IN (SELECT id FROM phantom_shops)
    RETURNING shop_id
)
DELETE FROM shops WHERE id IN (SELECT id FROM phantom_shops);
```

**Action:** Write migration → invoke `@db-guardian` to validate.

---

## Step 2: Layer 4 — Remove "Users" Tab from Platform Admin UI

**File:** `src/components/platform/PlatformLayout.tsx`
- Remove `Users` from lucide-react import
- Remove `UserManagement` import
- Remove `'users'` from `PlatformView` type
- Remove `{ key: 'users', ... }` nav item entry
- Remove `case 'users':` from `renderView()` switch

**File:** `src/components/platform/UserManagement.tsx`
- Add `// @deprecated Per VISION.md §4.4, platform_admin cannot manage staff.` at top

---

## Step 3: Layer 2 — Deprecate User-Management Edge Functions

**Files:**
- `supabase/functions/platform-admin-update-user-role/index.ts`
- `supabase/functions/platform-admin-toggle-user-active/index.ts`

**Change in both:** Insert early 403 after CORS, before any logic:
```
// @deprecated Per VISION.md §4.4, platform_admin cannot manage staff.
return new Response(JSON.stringify({ error: "..." }), { status: 403, headers });
```

**Note:** `platform-admin-list-users` is also a staff-management function. Will deprecate it too for consistency.

---

## Step 4: Documentation — VISION.md §17.3

**File:** `docs/vision/VISION.md` — add 3 entries to §17.3 table (deprecated):
- `platform-admin-list-users`
- `platform-admin-toggle-user-active`
- `platform-admin-update-user-role`

---

## Step 5: Verification

- `npx tsc --noEmit` — TypeScript check
- Log `@db-guardian` verdict in `.harness/guardian-log.md`

## Files Touched (7 total)

| File | Action |
|------|--------|
| `supabase/migrations/20260724000001_cleanup_phantom_shops.sql` | Create |
| `src/components/platform/PlatformLayout.tsx` | Edit — remove Users tab |
| `src/components/platform/UserManagement.tsx` | Edit — deprecation comment |
| `supabase/functions/platform-admin-update-user-role/index.ts` | Edit — 403 deprecation |
| `supabase/functions/platform-admin-toggle-user-active/index.ts` | Edit — 403 deprecation |
| `supabase/functions/platform-admin-list-users/index.ts` | Edit — 403 deprecation (bonus) |
| `docs/vision/VISION.md` | Edit — §17.3 add deprecated entries |
| `.harness/guardian-log.md` | Append — guardian verdict |

## Dead Code Left Behind

| Code | Reason Not Removed |
|------|-------------------|
| `platformAdminService.listUsers/updateUserRole/toggleUserActive` in `services.ts` | Avoid cascading changes; can prune in future |
