# Phase 2 E2E Test Plan — Tier Gating, Simplified Inventory & Reports

**Status:** 🟡 Awaiting Approval  
**Date:** 2026-07-14  
**Constraint:** READ-ONLY — No test code written yet  
**Authority:** VISION.md v3.1.0 (Scope Reframe)

---

## 1. Component Scan Results

### 1.1 Tier Gating (Capability-Based Nav)

**Files scanned:** `src/App.tsx`, `src/components/layout/Header.tsx`, `src/context/SupabaseAppContext.tsx`

**Routing:** Single-page state machine (`useState('pos')`) — no router library. View set via `currentView` state.

**Capability-gated views:**

| View ID | Component | Capability Required |
|---------|-----------|-------------------|
| `purchase-log` | `PurchaseLogManager` | `purchase_log` |
| `stock-overview` | `StockOverviewManager` | `stock_overview` |
| `reports` (sub-tab) | `SimpleProfitReport` | `simple_profit_report` |

**Nav item selectors (Header.tsx):**

| Label | Button text | Capability | CSS class (active) |
|-------|------------|------------|-------------------|
| Purchases | `"Purchases"` | `purchase_log` | `bg-primary-50 text-primary-700 shadow-soft` |
| Stock | `"Stock"` | `stock_overview` | Same |
| Simple Profit | Dropdown option: `"Simple Profit (Pro)"` | `simple_profit_report` | N/A — in Reports dropdown |

**`useCapability` hook:**
```typescript
// src/context/SupabaseAppContext.tsx:442-445
export function useCapability(name: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(name);
}
```

**Capabililities resolved server-side:** `resolveCapabilitiesRpc(shop.id)` calls Supabase RPC `resolve_capabilities`.

**Tier switching API:**
```typescript
// src/lib/services.ts:1773-1778
platformAdminService.updateSubscription(shopId: string, tier: 'free' | 'growth' | 'pro')
// Invokes Edge Function: platform-admin-update-subscription
// Body: { shop_id: string, tier: string }
```

**SimpleProfitReport is NOT a standalone view.** It's a sub-component inside `ReportsManager` (view `'reports'`), rendered when `reportType === 'simple-profit'`.

---

### 1.2 Simplified Inventory (Growth+ Tier)

**Files scanned:** `src/components/inventory/PurchaseLogManager.tsx`, `PurchaseLogModal.tsx`, `StockOverviewManager.tsx`

**No `data-testid` attributes found** in any inventory component. All selectors rely on text, roles, and CSS classes.

#### PurchaseLogManager

**Page heading:** `"Purchase Log"`  
**Add button:** `"Record Purchase"` (CSS: `btn btn-primary`)  
**Search input:** placeholder `"Search by item or supplier..."`  
**Date filter:** `<select class="select">` with value format `"YYYY-MM"`  

**Table columns:** Date | Item | Supplier | Quantity | Unit Cost | Total Cost | Actions

**Empty state:** `"No purchases recorded for this period."`  
**Stat cards:** `"Total Purchases"`, `"Total Cost (MMK)"`, `"Unique Items"`

#### PurchaseLogModal (form fields)

| Label | Input type | Required | Placeholder |
|-------|-----------|----------|-------------|
| `Item *` | `text` | Yes | `"e.g. Coffee beans, Milk"` |
| `Supplier` | `text` | No | `"e.g. ABC Suppliers"` |
| `Quantity *` | `number` | Yes | `"0"` |
| `Unit` | `<select>` | No | Default: `"piece"` |
| `Unit Cost (MMK) *` | `number` | Yes | `"0"` |
| `Purchase Date` | `date` | No | Default: today |
| `Notes` | `textarea` | No | `"Optional notes..."` |

**Unit options:** piece, kg, g, l, ml, box, pack  
**Submit button text:** `"Record Purchase"` (new) / `"Update Purchase"` (editing)  
**Success toast:** `"Purchase recorded!"`

#### StockOverviewManager

**Page heading:** `"Stock Overview"`  
**Add button:** `"Add Stock Item"` (CSS: `btn btn-primary`)  
**Search input:** placeholder `"Search stock items..."`  

**Table columns:** Item | Category | Quantity | Low Threshold | Status | Actions  
**Status badges:** `"Low Stock"` (badge-warning) or `"OK"` (badge-success)

**Action buttons per row:** Adjust (green arrow icon), Edit, Delete

**Empty state:** `"No stock items yet. Add your first supply item above."`  
**Stat cards:** `"Total Items"`, `"Low Stock"`, `"Categories"`

#### StockItemModal (inline — add/edit)

| Label | Input type | Required | Placeholder |
|-------|-----------|----------|-------------|
| `Item Name *` | `text` | Yes | `"e.g. Coffee Beans, Milk"` |
| `Current Quantity` | `number` | No | `"0"` |
| `Unit` | `<select>` | No | Default: `"piece"` |
| `Low Stock Threshold` | `number` | No | `"0"` |
| `Category` | `text` | No | `"e.g. Beans, Dairy"` |
| `Notes` | `textarea` | No | `"Optional notes..."` |

#### AdjustModal (inline — stock adjustment)

| Label | Input type | Required |
|-------|-----------|----------|
| `New Quantity *` | `number` | Yes |
| `Reason *` | `text` | Yes (placeholder: `"e.g. Weekly count, Damaged, Used"`) |

**Modal title:** `"Adjust Stock: {item.name}"`  
**Subtitle:** `"Current count: {item.quantity} {item.unit}"`  
**Submit button:** `"Confirm Adjustment"`

---

### 1.3 Simple Profit Report (Pro Tier)

**Files scanned:** `src/components/reports/ReportsManager.tsx`, `SimpleProfitReport.tsx`

**ReportsManager structure:** Tabbed reports with dropdown selector.  
**Report dropdown value:** `"simple-profit"`  
**Capability gate:** `hasSimpleProfit` (via `useCapability('simple_profit_report')`)  
**Missing capability:** Shows `<UpgradePrompt feature="Simple Profit Report" tier="pro" />`

**Date controls:** Month selector (not day-range) — `<select class="select min-w-[220px]">`  
**Options:** "July 2026", "June 2026", etc. (12 months rolling)  
**Value format:** `"YYYY-M"` (e.g., `"2026-6"`)

**KPI Cards (3 gradient cards):**

| Card | Label | Color |
|------|-------|-------|
| 1 | `"Revenue"` | blue-500 → blue-600 |
| 2 | `"Purchases"` | orange-500 → orange-600 |
| 3 | `"Profit"` | green (if ≥0), red (if <0) |

**Profit Calculation section:**
```
Total Revenue          | MMK {revenue}
Total Purchases        | - MMK {purchases}
───────────────────────┼─────────────────────
Net Profit             | MMK {profit} (green/red)
Profit Margin          | {margin}% (if revenue > 0)
```

**Footer note:** `"Formula: Revenue - Purchases = Profit. Purchases are recorded in Purchase Log (Growth+)."`

**Data sources:**
- Revenue: `salesService.getAll()` filtered by month + `status === 'completed'`
- Purchases: `purchaseLogsService.getMonthlyTotal(shopId, year, month)`

**Empty state:** Shows 0 values (no explicit empty message)

---

## 2. Test Scenario Matrix

### File 1: `tests/e2e/journeys/03-tier-gating.spec.ts`

**Fixture:** `{ authenticatedPage: page }` — platform_admin user (has full access)

#### Scenario 3.1: Free tier user does NOT see "Purchases" or "Stock" tabs

**Prerequisites:**
- Test shop is at `free` tier
- User is logged in as admin/manager (not cashier)

**Steps:**
1. Login as test-admin user
2. Navigate to main POS view
3. Assert nav bar does NOT contain button text `"Purchases"`
4. Assert nav bar does NOT contain button text `"Stock"`
5. Assert `"Reports"` tab is visible (admin/manager can see it)
6. Click `"Reports"` tab
7. Assert report dropdown does NOT show `"Simple Profit (Pro)"` option (or it's disabled)

**Assertions:**
- `page.locator('button:has-text("Purchases")').count()` === 0
- `page.locator('button:has-text("Stock")').count()` === 0
- Reports tab exists
- Simple Profit option disabled or absent in dropdown

---

#### Scenario 3.2: Upgrading to Growth tier reveals "Purchases" and "Stock" tabs

**Prerequisites:**
- Test shop starts at `free` tier (reset after 3.1)

**Steps:**
1. Login as test-admin user
2. Assert `"Purchases"` and `"Stock"` tabs are NOT visible
3. Call Platform Admin API: `platform-admin-update-subscription` with `{ shop_id, tier: 'growth' }`
4. Reload page (forces capability re-resolution)
5. Assert `"Purchases"` tab is now visible in nav
6. Assert `"Stock"` tab is now visible in nav
7. Click `"Purchases"` — assert page heading `"Purchase Log"` appears
8. Click `"Stock"` — assert page heading `"Stock Overview"` appears

**API call (via Playwright request):**
```typescript
await page.request.post(`${supabaseUrl}/functions/v1/platform-admin-update-subscription`, {
  headers: {
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  },
  data: { shop_id: testShopId, tier: 'growth' }
});
```

---

#### Scenario 3.3: Upgrading to Pro tier reveals "Simple Profit" tab in Reports

**Prerequisites:**
- Test shop at `growth` tier

**Steps:**
1. Login as test-admin user
2. Navigate to Reports view
3. Open report type dropdown
4. Assert `"Simple Profit (Pro)"` option exists but is NOT disabled (growth tier has `simple_profit_report` — need to verify this in tier-spec)
5. Upgrade to `pro` tier via API
6. Reload page
7. Navigate to Reports → Select "Simple Profit (Pro)"
8. Assert SimpleProfitReport component renders (heading: month selector, "Profit Calculation" section)

**Note:** Verify tier-spec.md — `simple_profit_report` minTier might be `growth` or `pro`. Adjust test accordingly.

---

### File 2: `tests/e2e/journeys/04-inventory.spec.ts`

**Fixture:** `{ authenticatedPage: page }` with `growth` tier or higher

#### Scenario 4.1: Record a new supplier purchase via PurchaseLogModal

**Steps:**
1. Login as test-admin user
2. Click nav button `"Purchases"`
3. Wait for page heading `"Purchase Log"` to appear
4. Click button `"Record Purchase"`
5. Assert modal title `"Record Purchase"` appears
6. Fill form:
   - Item: `"E2E Test Coffee Beans"`
   - Supplier: `"E2E Test Supplier"`
   - Quantity: `50`
   - Unit: select `"Kilogram"`
   - Unit Cost (MMK): `25000`
   - Purchase Date: today (or leave default)
   - Notes: `"E2E test purchase — will be cleaned up"`
7. Assert computed total shows `"MMK 1,250,000"`
8. Click submit button `"Record Purchase"`
9. Assert success toast `"Purchase recorded!"` appears

**Assertions:**
- Modal closes after submit
- No error toasts

---

#### Scenario 4.2: Verify the purchase appears in the PurchaseLogManager list

**Steps:**
1. After Scenario 4.1 completes (or in same test)
2. On Purchase Log page, verify table contains row with `"E2E Test Coffee Beans"`
3. Verify supplier column shows `"E2E Test Supplier"`
4. Verify quantity shows `"50 Kilogram"`
5. Verify unit cost shows `"MMK 25,000"`
6. Verify total cost shows `"MMK 1,250,000"`

**Optional cleanup:** Delete the test purchase via row action button (trash icon)

---

#### Scenario 4.3: Perform a manual stock adjustment in StockOverviewManager

**Steps:**
1. Login as test-admin user
2. Click nav button `"Stock"`
3. Wait for page heading `"Stock Overview"` to appear
4. Click button `"Add Stock Item"` (creates a new stock item first)
5. Fill StockItemModal:
   - Item Name: `"E2E Test Milk"`
   - Current Quantity: `100`
   - Unit: select `"Litre"`
   - Low Stock Threshold: `20`
   - Category: `"Dairy"`
6. Click submit button `"Add Stock Item"`
7. Assert success toast appears
8. On Stock Overview table, find row with `"E2E Test Milk"`
9. Click Adjust button (green arrow icon, title="Adjust stock count")
10. Assert modal title `"Adjust Stock: E2E Test Milk"` appears
11. Assert subtitle shows `"Current count: 100 Litre"`
12. Fill form:
    - New Quantity: `85`
    - Reason: `"E2E test adjustment — used 15L for testing"`
13. Assert diff indicator shows `"-15 Litre from previous count"` (red text)
14. Click button `"Confirm Adjustment"`
15. Assert success toast `"Stock adjusted successfully!"` appears
16. Verify table row now shows quantity `"85 Litre"`

---

### File 3: `tests/e2e/journeys/05-reports.spec.ts`

**Fixture:** `{ authenticatedPage: page }` with `pro` tier (has `simple_profit_report` capability)

#### Scenario 5.1: Navigate to Simple Profit Report

**Steps:**
1. Login as test-admin user
2. Click nav button `"Reports"`
3. Wait for ReportsManager to render
4. Open report type dropdown
5. Select option with value `"simple-profit"` (text: `"Simple Profit (Pro)"`)
6. Assert SimpleProfitReport renders:
   - Month selector dropdown is visible
   - Three KPI cards visible: "Revenue", "Purchases", "Profit"
   - "Profit Calculation" section heading visible

**Assertions:**
- Month selector has 12 options
- KPI cards show MMK amounts
- Profit Calculation section shows formula rows

---

#### Scenario 5.2: Verify the report calculates Profit = Revenue - Purchases

**Steps:**
1. After navigating to Simple Profit Report (Scenario 5.1)
2. Select current month from dropdown (if not already selected)
3. Read Revenue value from KPI card
4. Read Purchases value from KPI card
5. Read Profit value from KPI card
6. Assert: `Profit === Revenue - Purchases` (within rounding tolerance)

**Calculation verification:**
```typescript
// Extract MMK values from KPI cards
const revenueText = await page.locator('.stat-card:has-text("Revenue")').innerText();
const purchasesText = await page.locator('.stat-card:has-text("Purchases")').innerText();
const profitText = await page.locator('.stat-card:has-text("Profit")').innerText();

// Parse "MMK 150,000" → 150000
const parse = (s: string) => parseInt(s.replace(/[^0-9]/g, ''));
assertEqual(parse(profitText), parse(revenueText) - parse(purchasesText));
```

**Also verify:**
- Profit Calculation section shows same values in table format
- If revenue > 0, Profit Margin percentage is displayed
- Footer note text: `"Formula: Revenue - Purchases = Profit..."`

---

## 3. Technical Strategy

### 3.1 Tier Switching in Tests

**Problem:** E2E tests need to dynamically change a shop's tier to test capability gating.

**Recommended approach:** Direct API call to Supabase Edge Function via `page.request.post()`.

**Implementation:**
```typescript
// tests/e2e/helpers/tier-helpers.ts
import { Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function setShopTier(page: Page, shopId: string, tier: 'free' | 'growth' | 'pro') {
  const response = await page.request.post(
    `${SUPABASE_URL}/functions/v1/platform-admin-update-subscription`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { shop_id: shopId, tier },
    }
  );
  if (!response.ok()) {
    throw new Error(`Failed to set tier to ${tier}: ${response.status()}`);
  }
}
```

**Post-tier-change:** Force capability re-resolution by reloading the page:
```typescript
await page.reload({ waitUntil: 'networkidle' });
```

**Test shop ID:** Hardcode in `.env.test`:
```
TEST_SHOP_ID=<uuid-from-seed.sql>
```

---

### 3.2 Data Seeding & Isolation

**Current state:** Phase 1 tests have NO cleanup — they run against pre-existing seed data.

**Phase 2 recommendation:** Minimal API-based cleanup using `SUPABASE_SERVICE_ROLE_KEY`.

**Pattern:**
```typescript
// tests/e2e/helpers/db-helpers.ts
import { Page } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseDelete(page: Page, table: string, filter: Record<string, any>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    params.append(key, `eq.${value}`);
  }
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    }
  );
}

// Cleanup after inventory tests
export async function cleanupTestPurchases(page: Page) {
  await supabaseDelete(page, 'purchase_logs', { item: 'E2E Test Coffee Beans' });
}

export async function cleanupTestStockItems(page: Page) {
  await supabaseDelete(page, 'stock_items', { name: 'E2E Test Milk' });
}
```

**Test isolation approach:**
- Use unique test identifiers (prefix `"E2E Test"`) to avoid collisions
- Run cleanup in `afterEach` hooks
- For tier tests: reset tier to `free` after each test in `03-tier-gating.spec.ts`
- Sequential execution (already configured: `workers: 1`)

---

### 3.3 Selector Strategy

**Current state:** Zero `data-testid` attributes in production components. Phase 1 tests use text/role selectors.

**Recommendation:** Continue text/role pattern for consistency. Do NOT add `data-testid` attributes now (YAGNI — components are stable).

**Priority:**
1. **Text selectors** — `page.getByRole('button', { name: 'Record Purchase' })`
2. **Role + name** — `page.getByRole('textbox', { name: 'Item' })`
3. **Placeholder** — `page.getByPlaceholder('Search by item or supplier...')`
4. **CSS class + text** — `page.locator('.badge-warning:has-text("Low Stock")')`
5. **Table structure** — `page.locator('table tr', { hasText: 'E2E Test Coffee Beans' })`

**SweetAlert2 handling:** All success/error confirmations use `swalConfig.*`. E2E must handle popup dialogs:
```typescript
// Wait for SweetAlert2 popup
await page.waitForSelector('.swal2-popup');
await page.locator('.swal2-confirm').click();
```

---

### 3.4 Environment Variables Needed

Add to `.env.test`:
```
TEST_SHOP_ID=<shop-uuid>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # already exists
VITE_SUPABASE_URL=<project-url>              # already exists
```

---

## 4. Estimated Effort

| Task | Files | Est. Hours |
|------|-------|-----------|
| Create tier-helpers.ts | `tests/e2e/helpers/tier-helpers.ts` | 0.5h |
| Create db-helpers.ts | `tests/e2e/helpers/db-helpers.ts` | 1h |
| Write 03-tier-gating.spec.ts (3 scenarios) | `tests/e2e/journeys/03-tier-gating.spec.ts` | 2h |
| Write 04-inventory.spec.ts (3 scenarios) | `tests/e2e/journeys/04-inventory.spec.ts` | 2h |
| Write 05-reports.spec.ts (2 scenarios) | `tests/e2e/journeys/05-reports.spec.ts` | 1.5h |
| Update fixtures.ts (add tier fixtures) | `tests/e2e/fixtures.ts` | 0.5h |
| Update .env.test | `.env.test` | 0.25h |
| Debug & fix failing tests | — | 2h |
| **Total** | | **~9.75h** |

**Parallelizable:** Tier helpers + DB helpers (0.5h + 1h) can be done in parallel.  
**Sequential dependencies:** Spec files depend on helpers. Debug phase depends on all specs.

---

## 5. Open Questions

1. **Tier-spec verification needed:** Is `simple_profit_report` capability at `growth` or `pro` tier? The scan shows the dropdown says `"Simple Profit (Pro)"` but the actual `minTier` in `tier-spec.md` might differ. Need to verify before writing Scenario 3.3.

2. **Test shop isolation:** Should we create a dedicated test shop per spec file, or reuse one shop across all tests? Current Phase 1 pattern reuses the same shop.

3. **Cleanup scope:** The `purchase_logs` and `stock_items` tables may have RLS constraints. Need to verify that `SERVICE_ROLE_KEY` bypasses RLS for cleanup operations.

---

## 6. Out of Scope (VISION.md v3.1.0)

- ❌ Recipe BOM / Bill of Materials
- ❌ COGS calculation per product
- ❌ Consumption logging
- ❌ Kitchen Display System (KDS)
- ❌ Multi-currency / exchange rates
- ❌ Profit Margin Analytics (owner_insights, advanced_reports)
- ❌ Waste tracking
