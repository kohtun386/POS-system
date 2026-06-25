---
phase: 3
name: Kitchen KDS
status: pending
goal: Real-time kitchen display. Order lifecycle tracking. Print job queue.
effort: ~2 days
req_ids:
  - KDS-01
  - KDS-02
  - KDS-03
  - KDS-04
  - KDS-05
  - KDS-06
  - KDS-07
  - KDS-08
  - KDS-09
---

## Phase 3 — Kitchen KDS

**Goal:** Real-time kitchen display. Order lifecycle tracking. Print job queue.
**Effort:** ~2 days
**Spec:** `docs/specs/kitchen-workflow.md`
**Blocked by:** Phase 0 (ErrorBoundary), Phase 1 (feature flag: `kitchen_display`)

### Tasks

#### 3.1 — Migration: `kitchen_orders` + `print_jobs` Tables
- **File:** `supabase/migrations/20260624000004_kitchen_workflow.sql`
- **Change:** Both tables with `shop_id`, indexes, RLS policies:
  - `kitchen_orders`: SELECT all authenticated, INSERT all authenticated, UPDATE status all authenticated, DELETE admin/manager
  - `print_jobs`: Service-layer access only (no direct user policies)
- **Verify:** `supabase db push` succeeds. Tables visible.

#### 3.2 — Service Layer: `kitchenOrdersService` + `printJobsService`
- **Files:** `src/types/index.ts`, `src/lib/services.ts`
- **Change:** Add `KitchenOrder`, `PrintJob` types. Add both service objects with full CRUD + status transitions.
- **Verify:** TypeScript compiles. Services return data.

#### 3.3 — Realtime Hook: `useRealtimeSubscription`
- **Files:** New `src/hooks/useRealtimeSubscription.ts`
- **Change:** Generic Supabase Realtime hook. Subscribes to `postgres_changes` on a table filtered by `shop_id`. Returns live data with INSERT/UPDATE/DELETE handlers. Auto-reconnect on disconnect. 10s polling fallback.
- **Verify:** Insert a row in `kitchen_orders` via SQL → hook receives the event.

#### 3.4 — Checkout Integration: Create Kitchen Orders on Sale
- **Files:** `src/components/pos/CheckoutModal.tsx`, `src/lib/kitchenUtils.ts` (new)
- **Change:** After sale is created, for each eligible item (where `requiresPreparation !== false`): call `kitchenOrdersService.create()`. If printer configured, call `printJobsService.enqueue()`. Station assignment via `determineStation()` from `kitchenUtils.ts`. Gated by `kitchen_display` feature flag.
- **Verify:** Complete a sale → `kitchen_orders` rows created for eligible items. `print_jobs` rows created if printer enabled.

#### 3.5 — KDS UI: `KitchenDisplay` Component
- **Files:** New `src/components/kitchen/KitchenDisplay.tsx`, `src/components/kitchen/KitchenOrderCard.tsx`
- **Change:** Kanban layout with 3 columns (Pending, In Progress, Ready). Uses `useRealtimeSubscription` for live updates. Color-coded cards with elapsed timer. Touch-friendly (48px+ targets). Keyboard shortcuts (Enter/Space to advance, Escape to cancel). Station filter tabs. Audio alert on new order. Wrapped in ErrorBoundary.
- **Verify:** Sale completed → order appears on KDS instantly. Tap "Start" → moves to In Progress. Tap "Ready" → moves to Ready. Timer counts up.

#### 3.6 — KDS Status Flow Integration
- **Files:** `src/components/kitchen/KitchenDisplay.tsx`
- **Change:** Full 5-state flow: pending → in_progress → ready → picked_up → cancelled. Timestamps recorded at each transition (`started_at`, `completed_at`, `picked_up_at`). Cancel requires admin/manager role.
- **Verify:** Complete order lifecycle. Timestamps recorded correctly. Cashier can't cancel.

#### 3.7 — KDS Analytics: `KitchenStats` Component
- **Files:** New `src/components/kitchen/KitchenStats.tsx`
- **Change:** Dashboard with: average prep time, orders per hour, on-time %, cancellation rate, per-station load, busiest hours. Date range filter. Gated by `kitchen_display` feature flag.
- **Verify:** Stats computed from `kitchen_orders` data. Matches manual calculation.

#### 3.8 — KDS Settings: Printer Configuration
- **Files:** New `src/components/kitchen/KitchenSettings.tsx`
- **Change:** Enable/disable kitchen printer. Set printer ID. Station assignment config. Admin-only access.
- **Verify:** Toggle printer off → no `print_jobs` created on checkout. Toggle on → jobs created.

#### 3.9 — Navigation: Add KDS to Header
- **Files:** `src/components/layout/Header.tsx`, `src/App.tsx`
- **Change:** Add "Kitchen" nav item gated by `kitchen_display` feature flag. Add `KitchenDisplay` to `renderCurrentView()`.
- **Verify:** Flag on → KDS nav visible. Flag off → hidden. Cashier can access KDS.

**Phase 3 exit criteria:**
- 2 new tables with RLS
- Real-time KDS with Supabase Realtime WebSocket
- 5-state order lifecycle with timestamps
- Station routing (bar, espresso, food, pastry)
- Print job queue with retry
- KDS analytics dashboard
- Printer configuration UI
- ErrorBoundary wraps KDS
- Feature flag `kitchen_display` gates all KDS UI
- `npm run lint` passes