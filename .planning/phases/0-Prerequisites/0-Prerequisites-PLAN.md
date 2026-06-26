---
phase: 0
name: Prerequisites & Quick Wins
status: pending
goal: Unblock all three systems. Fix critical concerns. Zero feature changes.
effort: 2-3 hours
req_ids:
  - CONCERNS-2
  - CONCERNS-4
  - CONCERNS-8
  - CONCERNS-9
  - CONCERNS-10
  - CONCERNS-11
  - CONCERNS-23
---

## Phase 0 — Prerequisites & Quick Wins

**Goal:** Unblock all three systems. Fix critical concerns. Zero feature changes.
**Effort:** 2-3 hours
**Specs:** `docs/specs/dynamic-shop-configuration.md` (minimal slice), `docs/specs/feature-flags.md` (none yet)

### Tasks

#### 0.1 — Settings Role Guard (CONCERNS #2)
- **File:** `src/App.tsx` line 93
- **Change:** Add `userRole !== 'cashier'` check before rendering `<Settings />`
- **Verify:** Cashier logged in → redirected to POS, not settings

#### 0.2 — Add ErrorBoundary (CONCERNS #4)
- **Files:** New `src/components/ui/ErrorBoundary.tsx`, `src/App.tsx`
- **Change:** Class component with `componentDidCatch` + fallback UI. Wrap `<AppContent />` in `App.tsx`. Wrap KDS view specifically in Phase 3.
- **Verify:** Throw test error in a component → fallback UI renders, not white screen

#### 0.3 — Add `Shop` Type + `shopsService` (Dynamic Shop Config §2.5)
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add `Shop` interface. Create `shopsService.getByUserId(userId)` that queries `shop_memberships` → `shops`. Create `mapShopRow()`.
- **Verify:** TypeScript compiles. `shopsService.getByUserId()` returns shop for default user.

#### 0.4 — Add `state.shop` + `SET_SHOP` Action
- **File:** `src/context/SupabaseAppContext.tsx`
- **Change:** Add `shop: Shop` to `AppState`. Add `SET_SHOP` action + reducer case. Set `initialState.shop` with defaults. Update `loadData()` to call `shopsService.getByUserId(user.id)` in the `Promise.all`.
- **Verify:** App loads → `state.shop` populated with default shop data. `state.shop.id` is set.

#### 0.5 — Delete Dead Code (CONCERNS #8, #9, #10)
- **Files:** Delete `src/context/AppContext.tsx`, `src/components/examples/CurrencyExample.tsx`. Remove `react-router-dom`, `@supabase/auth-ui-react`, `@supabase/auth-ui-shared` from `package.json`.
- **Verify:** `npm run lint` passes. App still loads.

#### 0.6 — Create `shopMembershipsService` (CONCERNS #11)
- **Files:** `src/lib/services.ts`, `src/context/SupabaseAppContext.tsx`
- **Change:** Create `shopMembershipsService` with `getByUserId()`. Replace direct `supabase.from('shop_memberships')` call in `loadData()`.
- **Verify:** No direct `supabase.from()` calls outside services.

**Phase 0 exit criteria:**
- `state.shop` exists and is populated on login
- `state.shop.id` available for feature flag resolution
- ErrorBoundary wraps app content
- Settings role-guarded
- Dead code removed
- `npm run lint` passes