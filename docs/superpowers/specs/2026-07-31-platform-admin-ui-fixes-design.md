# Platform Admin UI Fixes — Design Spec

| Field | Value |
|-------|-------|
| **Date** | 2026-07-31 |
| **Status** | APPROVED |
| **Author** | Claude (state-refactor agent) |
| **Approver** | Ko Htun |

---

## Context

Ko Htun tested the live Platform Admin UI (pos-system-gilt-mu.vercel.app) and identified 6 issues:

1. Feature Catalog purpose unclear — unnecessary for v1
2. No settings page
3. No sign out button
4. No account name display
5. No light/dark mode toggle
6. VISION.md says "desktop" but should be mobile responsive

---

## Decisions

| Issue | Decision | Rationale |
|-------|----------|-----------|
| Feature Catalog | Hide from nav in v1 | Gate 2 (Business Type Defaults) is dormant — all v1 shops are `coffee_shop`. Keep code + Edge Function for v2. |
| Settings page | Skip | Platform admin is single-user (Ko Htun). Theme toggle + sign out in sidebar is sufficient. |
| Mobile scope | Minimal header | Hamburger + "Platform Admin" + user name + sign out. Sidebar gets theme toggle at bottom. |
| Docs | Update all 3 | VISION.md, design-system.md, database.md |

---

## Implementation

### File 1: `src/components/platform/PlatformLayout.tsx`

**Changes:**

1. **Add imports:**
   - `useAuth` from `../../context/AuthContext`
   - `useTheme` from `../../context/ThemeContext`
   - `User`, `Sun`, `Moon`, `LogOut` from `lucide-react`
   - `swalConfig` from `../../lib/sweetAlert`

2. **Remove Feature Catalog from nav:**
   - Delete the `{ key: 'features', label: 'Feature Catalog', icon: Settings }` entry from `navItems`
   - Remove `Settings` from lucide-react import (no longer used)
   - Remove `FeatureDefinitions` import and the `case 'features'` in `renderView`

3. **Add user profile section at sidebar bottom:**
   ```
   ┌──────────────────┐
   │ ...nav items...  │
   │                  │
   │ ─────────────── │
   │ 👤 Ko Htun      │
   │ platform_admin   │
   │ [🌙 Dark] [↗ Out]│
   └──────────────────┘
   ```
   - Use `useAuth()` for `profile` (name, role) and `signOut`
   - Use `useTheme()` for `isDark`, `toggleTheme`
   - Sign out: `swalConfig.confirm()` pattern from `Settings.tsx:77-92`
   - Theme toggle: Sun/Moon icons, `toggleTheme` from `Header.tsx:200-208`

4. **Add user info to mobile header:**
   ```
   ┌──────────────────────────────┐
   │ [☰] Platform Admin  Ko Htun [↗] │
   └──────────────────────────────┘
   ```
   - Show `profile.name` next to title
   - Sign out button (LogOut icon) on the right

### File 2: `docs/vision/VISION.md`

**§7.4 Platform Admin:**
- Change: "Desktop-first UI" → "Responsive UI — mobile-first for admin-on-the-go, desktop-optimized for management tasks"

**§17.5 Platform Admin UI:**
- Add to component list:
  ```
  ├── User profile display (name, role badge)
  ├── Sign out button (with confirmation dialog)
  └── Theme toggle (light/dark, persisted to localStorage)
  ```

### File 3: `docs/architecture/design-system.md`

**§10.3 heading:**
- Change: "Platform Admin (Desktop-First)" → "Platform Admin (Responsive)"

**§10.3 intro text:**
- Change: "Target: Ko Htun's desktop for managing all shops" → "Target: Ko Htun's desktop and mobile for managing all shops"

### File 4: `docs/architecture/database.md`

**§7.1 `feature_definitions`:**
- Add note after the table:
  ```
  > **v1 Note:** All shops are `coffee_shop` — `applicable_types` is dormant.
  > Will activate when v2 adds `restaurant`/`food_court` business types (VISION.md §2.2).
  ```

---

## Verification

1. `npx tsc --noEmit` — no type errors
2. `npm run build` — build succeeds
3. Manual: Platform admin shows user name + role in sidebar
4. Manual: Sign out button triggers confirmation dialog and logs out
5. Manual: Theme toggle switches light/dark mode
6. Manual: Feature Catalog no longer appears in sidebar nav
7. Manual: Mobile header shows user name + sign out
