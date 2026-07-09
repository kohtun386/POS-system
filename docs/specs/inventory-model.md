# Simplified Inventory Model — Design Specification

**Status:** Active (v1)
**Replaces:** `docs/archive/recipe-bom.md`, `docs/archive/recipe-bom-user-workflow.md`, `docs/archive/waste-tracking.md`

---

## Overview

A simplified inventory model designed for Myanmar coffee shops that buy supplies in bulk and sell finished drinks. No per-recipe ingredient tracking, no auto-deduction, no COGS calculation.

**Business reality:**
- Buy supplies weekly/monthly (beans, milk, cups, sugar)
- Sell finished drinks daily
- Want to know when supplies are low
- Calculate profit monthly: Revenue − Purchases

---

## 1. Purchase Log (Growth+)

### Purpose

Owner records what they bought, from whom, and how much it cost. This is the foundation for the simple profit report.

### Data Model (Proposed)

```typescript
interface PurchaseLog {
  id: string;
  shopId: string;
  date: Date;
  supplier: string;          // "ABC Beans Co.", "City Milk"
  item: string;              // "Coffee beans", "Fresh milk", "Medium cups"
  quantity: number;
  unit: string;              // "kg", "L", "piece", "pack"
  unitCost: number;          // cost per unit in MMK
  totalCost: number;         // quantity × unitCost
  notes?: string;
  createdAt: Date;
}
```

### Workflow

1. Owner buys 5 kg of coffee beans from ABC Beans Co. at 8,000 MMK/kg
2. Opens Purchase Log → "Add Purchase"
3. Fills in: Date, Supplier, Item, Quantity (5), Unit (kg), Unit Cost (8,000)
4. System calculates Total Cost: 40,000 MMK
5. Saves record

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| date | date | ✅ | When the purchase was made |
| supplier | text | ✅ | Supplier name (free text) |
| item | text | ✅ | What was bought |
| quantity | number | ✅ | Amount purchased |
| unit | text | ✅ | kg, L, piece, pack, etc. |
| unitCost | number | ✅ | Cost per unit in MMK |
| totalCost | number | auto | quantity × unitCost |
| notes | text | ❌ | Optional notes |

---

## 2. Stock Overview (Growth+)

### Purpose

Current supply levels with manual adjustment. Not auto-calculated from purchases — owner updates weekly after physical count.

### Data Model (Proposed)

```typescript
interface StockItem {
  id: string;
  shopId: string;
  name: string;              // "Coffee beans", "Fresh milk"
  category: 'ingredient' | 'packaging' | 'consumable';
  currentStock: number;      // owner-entered current level
  minimumStock: number;      // threshold for low stock alert
  unit: string;              // kg, L, piece, etc.
  lastUpdated: Date;
  createdAt: Date;
}
```

### Workflow

1. Owner does weekly physical count
2. Opens Stock Overview → updates currentStock for each item
3. System records the adjustment with timestamp
4. If currentStock ≤ minimumStock → low stock alert triggers

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | text | ✅ | Supply name |
| category | enum | ✅ | ingredient, packaging, consumable |
| currentStock | number | ✅ | Current level (manual entry) |
| minimumStock | number | ✅ | Low stock threshold |
| unit | text | ✅ | kg, L, piece, etc. |

---

## 3. Low Stock Alerts (Growth+)

### Purpose

Notify owner when supply levels drop below threshold.

### How It Works

1. Owner sets `minimumStock` for each stock item
2. System checks stock levels periodically (or on stock update)
3. When `currentStock ≤ minimumStock` → alert triggers
4. Alert sent via configured channel (email, SMS, or both)

### Alert Types

| Alert | Condition | Example |
|-------|-----------|---------|
| Low Stock | currentStock ≤ minimumStock | "Coffee beans at 1.5 kg (minimum: 2 kg)" |
| Out of Stock | currentStock = 0 | "Fresh milk is out of stock" |

### Configuration

- Recipients: who gets alerts (admin, manager)
- Channels: email, SMS, or both
- Frequency: how often to check (hourly, daily)

---

## 4. Simple Profit Report (Pro)

### Purpose

Monthly profit calculation: Revenue − Purchases. No per-recipe COGS.

### Data Model (Proposed)

```typescript
interface ProfitReport {
  period: string;            // "2026-07" (YYYY-MM)
  revenue: number;           // sum of all sales in period
  purchases: number;         // sum of all purchase logs in period
  profit: number;            // revenue - purchases
  profitMargin: number;      // (profit / revenue) × 100
  salesCount: number;
  purchaseCount: number;
}
```

### How It Works

1. Owner selects month (e.g., July 2026)
2. System calculates:
   - **Revenue** = sum of all completed sales in July
   - **Purchases** = sum of all purchase log entries in July
   - **Profit** = Revenue − Purchases
   - **Profit Margin** = (Profit / Revenue) × 100
3. Displays three numbers: Revenue, Purchases, Profit

### Example

```
July 2026:
  Revenue:    1,500,000 MMK (300 sales)
  Purchases:    450,000 MMK (12 purchase entries)
  Profit:     1,050,000 MMK
  Margin:     70%
```

---

## 5. Tier Gating

| Feature | Free | Growth | Pro |
|---------|------|--------|-----|
| Product management | ✅ (50 max) | ✅ (unlimited) | ✅ (unlimited) |
| Purchase log | ❌ | ✅ | ✅ |
| Stock overview | ❌ | ✅ | ✅ |
| Low stock alerts | ❌ | ✅ | ✅ |
| Simple profit report | ❌ | ❌ | ✅ |

---

## 6. What We Do NOT Build

| Feature | Reason |
|---------|--------|
| Recipe BOM | Too complex for Myanmar coffee shop workflow |
| Auto-deduct ingredients | Requires precise recipe data; shops don't track this |
| Per-drink COGS | Monthly profit (Revenue − Purchases) is sufficient |
| Consumption log | No auto-deduction means no consumption to log |
| UOM conversion | Not needed without recipe tracking |
| Waste tracking per recipe | No recipe tracking; use low stock alerts instead |
| Kitchen Display System | Not practical in Myanmar; use thermal printer |

---

## 7. Database Tables (Existing)

The following tables already exist in the schema from the v3 vision migration. They are NOT used by the simplified inventory model but remain for forward compatibility:

| Table | Status | Notes |
|-------|--------|-------|
| `raw_materials` | Exists, unused by simplified model | Was for recipe BOM |
| `recipes` | Exists, unused by simplified model | Was for recipe BOM |
| `recipe_lines` | Exists, unused by simplified model | Was for recipe BOM |
| `consumption_log` | Exists, unused by simplified model | Was for auto-deduction audit |
| `uom_conversions` | Exists, unused by simplified model | Was for unit conversion |

**New tables needed for simplified model:**

| Table | Purpose |
|-------|---------|
| `purchase_logs` | Purchase recording |
| `stock_items` | Current supply levels |

**Note:** This is a docs-only task. No SQL migrations are created here.
