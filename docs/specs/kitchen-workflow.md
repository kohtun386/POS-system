# Kitchen Workflow System — Design Specification

> **⚠️ DEPRECATED (2026-07-04):** This spec describes a Kitchen Display System (KDS) screen.
> In the Myanmar coffee shop market, no one uses physical KDS screens. The standard workflow is
> POS → Kitchen Thermal Printer. KDS screen components have been deleted from the codebase.
> Kitchen printer routing is handled via `printer_integration` (Growth tier) in `Settings.tsx`.
> The `kitchen_display` DB key is dead code — kept for forward compatibility only.

## Overview

A Kitchen Display System (KDS) that replaces paper ticket printers with a real-time digital display. Orders flow from the POS to a kitchen screen, staff prepare items, and mark them complete — all tracked with timestamps for performance analytics.

## Architecture

### Component Diagram

```
┌──────────────┐     Supabase      ┌─────────────────┐     Supabase Realtime     ┌──────────────┐
│   POS Terminal│ ──── INSERT ────→ │  kitchen_orders  │ ←─── SUBSCRIBE ────────→ │  Kitchen      │
│  (React app)  │                   │  print_jobs      │                          │  Display (KDS)│
└──────────────┘                    └─────────────────┘                           └──────────────┘
                                          │
                                    poll / dequeue
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Print Service │ → Thermal Printer (USB)
                                   │ (Node process)│
                                   └─────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Kitchen order storage | Separate `kitchen_orders` table | Independent lifecycle, richer status tracking, doesn't bloat `sales` table |
| Real-time delivery | Supabase Realtime (WebSocket) | Built-in to Supabase, no polling, instant updates, handles reconnection |
| Print reliability | `print_jobs` queue table | Survives printer offline, retry with backoff, audit trail |
| Printer integration | Separate Node/Electron service | Thermal printers need USB access (not browser), can run on dedicated hardware |

## Database Schema

### `kitchen_orders`

Tracks individual items sent to the kitchen. One sale can produce multiple kitchen orders (one per item).

```sql
CREATE TABLE kitchen_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Source
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,          -- human-readable, matches sales.invoice_number

  -- Item details (denormalized for kitchen display — no joins needed)
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,

  -- Modifiers & notes
  modifiers JSONB DEFAULT '[]',       -- [{name: "Extra Shot", price: 0.50}, ...]
  notes TEXT,                          -- customer notes, special instructions

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'ready', 'picked_up', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,             -- when status → in_progress
  completed_at TIMESTAMPTZ,           -- when status → ready
  picked_up_at TIMESTAMPTZ,           -- when status → picked_up

  -- Metadata
  priority INTEGER DEFAULT 0,         -- 0 = normal, 1 = priority (e.g., VIP, delivery rush)
  station TEXT,                        -- 'bar', 'espresso', 'food', 'pastry' (future: multi-station)
  created_by UUID REFERENCES users(id),
  prepared_by UUID REFERENCES users(id),

  -- Timing
  estimated_minutes INTEGER,          -- estimated prep time at order creation
  actual_minutes INTEGER              -- computed: completed_at - created_at (for analytics)
);

-- Indexes
CREATE INDEX idx_kitchen_orders_status ON kitchen_orders(status);
CREATE INDEX idx_kitchen_orders_sale ON kitchen_orders(sale_id);
CREATE INDEX idx_kitchen_orders_created ON kitchen_orders(created_at);
CREATE INDEX idx_kitchen_orders_station ON kitchen_orders(station);
CREATE INDEX idx_kitchen_orders_shop ON kitchen_orders(shop_id);
```

### `print_jobs`

Reliable print queue. The print service polls this table and processes jobs.

```sql
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- What to print
  job_type TEXT NOT NULL
    CHECK (job_type IN ('kitchen_ticket', 'receipt', 'order_summary')),
  payload JSONB NOT NULL,             -- structured data the print service renders
  raw_content TEXT,                    -- pre-rendered ESC/POS or plain text (optional)

  -- Status & retry
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,

  -- Target printer
  printer_id TEXT,                     -- logical printer name (maps to device in print service config)
  printer_type TEXT DEFAULT 'thermal'  -- 'thermal' | 'receipt' | 'label'
    CHECK (printer_type IN ('thermal', 'receipt', 'label')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Source
  reference_type TEXT,                 -- 'kitchen_order' | 'sale'
  reference_id UUID                    -- FK to kitchen_orders.id or sales.id
);

-- Indexes
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_pending ON print_jobs(status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX idx_print_jobs_shop ON print_jobs(shop_id);
```

## Real-time Subscriptions

### KDS Display subscribes to kitchen_orders

```typescript
// In KDS component
const channel = supabase
  .channel('kitchen-orders')
  .on('postgres_changes',
    {
      event: '*',                      // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'kitchen_orders',
      filter: `shop_id=eq.${shopId}`,  // scoped to current shop
    },
    (payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          // New order — add to display, play sound
          break;
        case 'UPDATE':
          // Status change — move between columns
          break;
        case 'DELETE':
          // Order removed (cancelled or cleanup)
          break;
      }
    }
  )
  .subscribe();
```

### POS subscribes to status updates (optional)

The POS terminal can show a small status indicator when kitchen items are ready.

## Kitchen Display (KDS) UI

### Layout: Kanban-style columns

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔔 Kitchen Display                    [Bar] [Espresso] [Food] [All]   │
├──────────────┬──────────────┬──────────────┬──────────────────────────┤
│   PENDING    │  IN PROGRESS │    READY     │  TIME                    │
│              │              │              │                          │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │  Orders: 12              │
│ │#1042     │ │ │#1040     │ │ │#1038     │ │  Avg prep: 4:32          │
│ │Cappuccino│ │ │Latte x2  │ │ │Americano │ │  On time: 92%            │
│ │+ Extra   │ │ │          │ │ │          │ │                          │
│ │  Shot    │ │ │  ▓▓▓░░   │ │ │  ✓ Ready │ │                          │
│ │          │ │ │  3:00    │ │ │  2:15    │ │                          │
│ │ [Start→] │ │ │ [Ready→] │ │ │[Picked↑] │ │                          │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │                          │
│              │              │              │                          │
│ ┌──────────┐ │              │              │                          │
│ │#1043     │ │              │              │                          │
│ │Croissant │ │              │              │                          │
│ │ Note:    │ │              │              │                          │
│ │ warmed   │ │              │              │                          │
│ │ [Start→] │ │              │              │                          │
│ └──────────┘ │              │              │                          │
└──────────────┴──────────────┴──────────────┴──────────────────────────┘
```

### Status Flow

```
         POS Checkout
              │
              ▼
         ┌─────────┐
         │ PENDING  │  ← Created on checkout, kitchen sees it
         └────┬────┘
              │ [Start]
              ▼
       ┌─────────────┐
       │ IN PROGRESS  │  ← Staff is preparing
       └──────┬──────┘
              │ [Ready]
              ▼
          ┌───────┐
          │ READY  │  ← Waiting for pickup / delivery
          └───┬───┘
              │ [Picked Up]
              ▼
        ┌──────────┐
        │ PICKED UP │  ← Completed, removed from active display
        └──────────┘

         CANCELLED    ← Can happen from PENDING or IN_PROGRESS
```

### Features

- **Color-coded cards:** PENDING (yellow), IN PROGRESS (blue), READY (green), OVERDUE (red pulse)
- **Elapsed timer:** Shows time since order was created (counts up)
- **Audio alert:** Chime on new order, distinct tone when order is ready
- **Priority flag:** Visual indicator for rush orders
- **Station filter:** Tabs to filter by prep station (bar, espresso, food)
- **Touch-friendly:** Large tap targets (48px+), swipe gestures for status changes
- **Bump bar support:** Keyboard shortcuts for stations without touch screens

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Advance selected order to next status |
| `Backspace` | Go back one status |
| `Escape` | Cancel selected order (with confirmation) |
| `↑` / `↓` | Navigate between orders |
| `←` / `→` | Switch station filter |
| `F` | Toggle fullscreen |

## Service Layer

### `kitchenOrdersService`

```typescript
export const kitchenOrdersService = {
  getAll(filters?: { status?: string; station?: string }): Promise<KitchenOrder[]>,
  getBySaleId(saleId: string): Promise<KitchenOrder[]>,
  create(data: CreateKitchenOrderInput): Promise<KitchenOrder>,
  updateStatus(
    id: string,
    status: KitchenOrderStatus,
    userId?: string
  ): Promise<KitchenOrder>,
  cancel(id: string, reason?: string): Promise<KitchenOrder>,
  getStats(period?: 'today' | 'week' | 'month'): Promise<KitchenStats>,
  cleanup(olderThanDays?: number): Promise<number>,  // archive old orders
}
```

### `printJobsService`

```typescript
export const printJobsService = {
  enqueue(job: CreatePrintJobInput): Promise<PrintJob>,
  getPending(limit?: number): Promise<PrintJob[]>,
  markProcessing(id: string): Promise<void>,
  markCompleted(id: string): Promise<void>,
  markFailed(id: string, error: string): Promise<void>,
  retry(id: string): Promise<PrintJob>,
  cancel(id: string): Promise<void>,
}
```

## Integration Points

### Checkout Flow (in CheckoutModal)

When a sale is completed, the checkout flow creates kitchen orders for eligible items:

```typescript
// After sale is created in Supabase
const eligibleItems = sale.items.filter(item =>
  item.requiresPreparation !== false  // opt-in by default, can exclude pre-packaged items
);

for (const item of eligibleItems) {
  const kitchenOrder = await kitchenOrdersService.create({
    saleId: sale.id,
    orderNumber: sale.invoiceNumber,
    productId: item.productId,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    modifiers: item.modifiers || [],
    notes: item.notes,
    station: determineStation(item),  // product category → station mapping
    createdBy: user.id,
  });

  // Queue for printing (if printer configured)
  if (settings.kitchenPrinterEnabled) {
    await printJobsService.enqueue({
      jobType: 'kitchen_ticket',
      payload: formatKitchenTicket(kitchenOrder),
      printerId: settings.kitchenPrinterId,
      referenceType: 'kitchen_order',
      referenceId: kitchenOrder.id,
    });
  }
}
```

### Station Assignment

Products are assigned to stations based on their category or an explicit field:

```typescript
function determineStation(item: CartItem): string {
  // Explicit station assignment on product (preferred)
  if (item.station) return item.station;

  // Default mapping by category
  const categoryStationMap: Record<string, string> = {
    'Espresso Drinks': 'espresso',
    'Brewed Coffee': 'espresso',
    'Tea': 'espresso',
    'Cold Drinks': 'bar',
    'Smoothies': 'bar',
    'Pastries': 'pastry',
    'Sandwiches': 'food',
    'Salads': 'food',
  };

  return categoryStationMap[item.category] || 'general';
}
```

### Print Service (Separate Process)

A standalone Node.js or Electron app that:

1. Polls `print_jobs` table every 2 seconds for `pending` jobs
2. Renders tickets using ESC/POS commands
3. Sends to thermal printer via USB (using `escpos` or `node-thermal-printer`)
4. Updates job status on success/failure
5. Retries failed jobs with exponential backoff

```
┌─────────────────────────────────────────────┐
│            Print Service (Node)              │
│                                              │
│  1. Poll print_jobs WHERE status = 'pending' │
│  2. For each job:                            │
│     a. Render ESC/POS from payload           │
│     b. Send to printer via USB               │
│     c. Update status → completed/failed      │
│  3. Sleep 2s, repeat                         │
│                                              │
│  Config: printer device path, retry policy   │
└─────────────────────────────────────────────┘
```

## Analytics & Reporting

### Tracked Metrics

| Metric | Source | Use |
|--------|--------|-----|
| Average prep time | `actual_minutes` | Staff performance, menu pricing |
| Orders per hour | `created_at` count | Staffing decisions |
| On-time % | `actual_minutes` vs `estimated_minutes` | Kitchen efficiency |
| Cancellation rate | `status = 'cancelled'` | Quality issues, training |
| Busiest hours | `created_at` histogram | Shift scheduling |
| Per-station load | `station` grouping | Workflow optimization |

### Kitchen Stats API

```typescript
interface KitchenStats {
  period: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averagePrepMinutes: number;
  medianPrepMinutes: number;
  onTimePercentage: number;          // actual <= estimated
  byStation: Record<string, {
    total: number;
    avgMinutes: number;
  }>;
  byHour: Record<string, number>;    // hour → order count
  peakHour: string;
}
```

## Permissions

| Action | Admin | Manager | Cashier |
|--------|-------|---------|---------|
| View KDS | ✓ | ✓ | ✓ |
| Update order status | ✓ | ✓ | ✓ |
| Cancel order | ✓ | ✓ | ✗ |
| View analytics | ✓ | ✓ | ✗ |
| Cleanup old orders | ✓ | ✗ | ✗ |
| Configure printers | ✓ | ✗ | ✗ |

## Feature Flag Integration

Gated by `KITCHEN_DISPLAY` feature flag (see `docs/specs/feature-flags.md`):

- **Flag off:** No KDS nav item, no kitchen_orders created on checkout, print_jobs not enqueued
- **Flag on:** Full KDS workflow active
- **Fallback:** If Realtime connection drops, KDS polls every 10 seconds as backup

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/xxx_create_kitchen_orders.sql` | Create | kitchen_orders table + indexes |
| `supabase/migrations/xxx_create_print_jobs.sql` | Create | print_jobs table + indexes |
| `src/types/index.ts` | Modify | Add KitchenOrder, PrintJob types |
| `src/lib/services.ts` | Modify | Add kitchenOrdersService, printJobsService |
| `src/context/SupabaseAppContext.tsx` | Modify | Add kitchen order state + reducer actions |
| `src/components/kitchen/KitchenDisplay.tsx` | Create | Main KDS screen |
| `src/components/kitchen/KitchenOrderCard.tsx` | Create | Individual order card component |
| `src/components/kitchen/KitchenStats.tsx` | Create | Analytics dashboard |
| `src/components/kitchen/KitchenSettings.tsx` | Create | Printer config, station setup |
| `src/lib/kitchenUtils.ts` | Create | Station assignment, ticket formatting |
| `src/hooks/useRealtimeSubscription.ts` | Create | Shared Realtime hook |
| `src/components/pos/CheckoutModal.tsx` | Modify | Create kitchen orders on checkout |
| `src/components/layout/Header.tsx` | Modify | Add KDS nav item (flagged) |
| `src/components/layout/Sidebar.tsx` | Modify | Add KDS nav item (flagged) |
| `src/App.tsx` | Modify | Add KDS route/view |
| `src/lib/printService.ts` | Create | Print job formatting utilities |

## Future Enhancements

- **Multi-printer support:** Different printers for different stations
- **Caller ID integration:** Show customer name with order for pickup
- **Voice announcements:** Text-to-speech for "Order #1042 ready"
- **Bump bar hardware:** Physical buttons connected via USB HID
- **Order grouping:** Group items from same sale together on display
- **Delayed orders:** Schedule orders for future preparation (e.g., catering)
- **Recipe display:** Show preparation notes/recipe on card tap
