# Waste Tracking — User Workflow Guide

## Overview

Waste tracking lets you record ingredients and supplies that were lost, spoiled, or damaged — but were never sold. This includes spilled milk, expired beans, broken cups, and anything else that reduces your stock without generating revenue.

By tracking waste, you understand your true costs. A shop that sells 100 Cappuccinos but wastes 20 cups of milk has a very different profit picture than one that wastes nothing.

## Tier Access

| Tier | Access Level | Notes |
|------|-------------|-------|
| Free | No access | Waste tracking is a Pro-only feature. Upgrade prompts appear when accessing waste reports. |
| Growth | No access | Same as Free — upgrade to Pro for waste tracking. |
| Pro | Full access | Record waste, view waste reports, analyze waste impact on profitability. |

---

## Why Track Waste?

Waste directly affects your bottom line. Consider this example:

- You sell 50 Cappuccinos per day
- Each Cappuccino uses 200ml of milk (cost: 300 MMK)
- Daily milk usage for sales: 10,000ml (cost: 15,000 MMK)
- But you actually use 12,000ml per day — the extra 2,000ml is waste (spillage, expired milk, etc.)
- Daily milk waste cost: 3,000 MMK
- Monthly milk waste cost: 90,000 MMK

That 90,000 MMK comes straight out of your profit. Without waste tracking, you would not know where that money went.

**Common sources of waste in a coffee shop:**
- Spilled drinks during preparation
- Expired ingredients (milk, syrups, fresh produce)
- Dropped or damaged items (broken cups, crushed pastries)
- Failed preparations (wrong order, customer rejected)
- Staff consumption (if not tracked separately)
- Theft or unaccounted loss

---

## Step-by-Step Workflow

### Step 1: Record Waste

When waste occurs, record it immediately so your inventory stays accurate.

1. **Navigate to:** Inventory → Waste (or Reports → Waste → Record Waste)
2. **Click:** "Record Waste"
3. **Fill in the form:**
   - **Raw Material:** Select the ingredient that was wasted (e.g., "Whole Milk")
   - **Quantity:** How much was wasted (e.g., 500)
   - **Unit:** The unit matches the raw material's base unit (e.g., "ml")
   - **Reason:** Select one:
     - *Spoiled* — expired or went bad
     - *Spillage* — accidentally spilled
     - *Damaged* — physical damage (broken container, crushed item)
     - *Failed Preparation* — made incorrectly and discarded
     - *Customer Return* — customer rejected the product
     - *Other* — any other reason
   - **Notes:** Optional details (e.g., "Milk left out overnight by staff")
   - **Date:** When the waste occurred (defaults to today)
4. **Click:** "Save"
5. **System response:**
   - The waste is recorded in the waste log
   - The raw material's stock is reduced by the wasted quantity
   - The waste is added to the waste report for the current period

**Important:** Recording waste reduces your raw material stock, just like a sale would. If you waste 500ml of milk, your milk stock drops by 500ml. This keeps your inventory accurate.

### Step 2: View Waste History

1. **Navigate to:** Reports → Waste
2. **Select:** Date range (e.g., "This Week", "This Month", or custom dates)
3. **See the waste log:**
   - Date and time of each waste entry
   - Raw material name
   - Quantity wasted
   - Reason
   - Cost of the waste (calculated from the raw material's cost per unit)
   - Who recorded it (staff member)
4. **Filter by:**
   - Raw material (e.g., show only milk waste)
   - Reason (e.g., show only spoiled items)
   - Date range

### Step 3: Analyze Waste Reports

The waste report helps you understand patterns and take action.

1. **Navigate to:** Reports → Waste
2. **View the summary cards:**
   - **Total Waste Cost:** How much money you lost to waste this period
   - **Waste as % of Revenue:** What portion of your revenue was lost to waste
   - **Top Wasted Material:** Which ingredient you waste the most
   - **Top Waste Reason:** Whether spoilage, spillage, or other is the biggest problem
3. **View the breakdown tables:**

   **By Material:**
   | Material | Quantity Wasted | Cost | % of Total Waste |
   |----------|----------------|------|------------------|
   | Whole Milk | 5,000 ml | 7,500 MMK | 45% |
   | Espresso Beans | 500 g | 7,500 MMK | 35% |
   | Vanilla Syrup | 200 ml | 2,000 MMK | 12% |
   | Cups (Medium) | 15 units | 1,500 MMK | 8% |

   **By Reason:**
   | Reason | Count | Total Cost | % of Total Waste |
   |--------|-------|------------|------------------|
   | Spoiled | 12 | 8,000 MMK | 42% |
   | Spillage | 25 | 6,500 MMK | 34% |
   | Failed Prep | 8 | 3,000 MMK | 16% |
   | Damaged | 5 | 1,500 MMK | 8% |

4. **Use this to take action:**
   - High spoilage? Check storage conditions, order smaller quantities more frequently
   - High spillage? Train staff on careful pouring, invest in better equipment
   - High failed preparations? Improve training, simplify complex recipes
   - High damage? Check storage organization, handle items more carefully

### Step 4: Understand Waste Impact on Profitability

Waste reduces your profit. The system calculates this automatically.

1. **Navigate to:** Reports → Profit Margins (Pro tier)
2. **See the waste adjustment:**
   - **Revenue:** Total sales for the period
   - **COGS (Cost of Goods Sold):** Cost of ingredients used in sales
   - **Waste Cost:** Cost of ingredients wasted (not sold)
   - **Gross Profit:** Revenue - COGS - Waste Cost
   - **Profit Margin:** Gross Profit as a percentage of Revenue

**Example:**
| Metric | Amount |
|--------|--------|
| Revenue | 500,000 MMK |
| COGS | 125,000 MMK |
| Waste Cost | 15,000 MMK |
| **Gross Profit** | **360,000 MMK** |
| **Profit Margin** | **72%** |

Without waste tracking, you would see a profit margin of 75% (375,000 MMK). Waste cost you 3% of your margin — 15,000 MMK that month.

---

## UI Screens

### Waste Recording Screen

- **Location:** Inventory → Waste → Record Waste
- **Purpose:** Log a waste event
- **Key Elements:**
  - **Raw Material dropdown:** Select from your active raw materials
  - **Quantity input:** Numeric input for amount wasted
  - **Unit display:** Shows the base unit of the selected raw material (read-only)
  - **Reason dropdown:** Spoiled, Spillage, Damaged, Failed Preparation, Customer Return, Other
  - **Notes text field:** Optional free-text explanation
  - **Date picker:** When the waste occurred
  - **Cost preview:** Shows the calculated cost of this waste in real-time as you enter quantity
- **User Actions:**
  - Select raw material → unit and cost preview update
  - Enter quantity → cost preview updates
  - Click "Save" → waste recorded, stock reduced

### Waste Report Screen

- **Location:** Reports → Waste
- **Purpose:** Analyze waste patterns over time
- **Key Elements:**
  - **Date range picker:** This Week, This Month, Last Month, Custom
  - **Summary cards:** Total waste cost, waste % of revenue, top wasted material, top waste reason
  - **By Material table:** Breakdown of waste per raw material
  - **By Reason table:** Breakdown of waste by cause
  - **Trend chart:** Waste over time (daily or weekly)
  - **Waste log:** Detailed list of every waste entry in the period
- **User Actions:**
  - Change date range → report updates
  - Click a material name → filter to show only that material's waste
  - Click a reason → filter to show only that reason
  - Export → Download waste log as CSV

### Waste Entry in Consumption Report

- **Location:** Reports → Consumption
- **Purpose:** See waste alongside regular consumption
- **Key Elements:**
  - The consumption report includes waste as a separate line item
  - For each raw material, you see: quantity used in sales, quantity wasted, total consumed
- **User Actions:**
  - Review waste alongside consumption to spot anomalies

---

## Error Handling

### "Insufficient stock to record waste"

- **When it happens:** You try to record more waste than is currently in stock (e.g., stock is 200ml but you enter 500ml of waste)
- **User sees:** *"Cannot record waste: Current stock for Whole Milk is 200ml but you are trying to record 500ml of waste."*
- **User should:** Check the actual stock level and enter the correct waste quantity. If the stock level itself is wrong, do a stock adjustment first.

### "Cannot waste zero or negative quantity"

- **When it happens:** Entering 0 or a negative number in the quantity field
- **User sees:** *"Please enter a positive quantity."*
- **User should:** Enter the actual amount wasted

### "Raw material not found"

- **When it happens:** The raw material was deactivated or deleted
- **User sees:** The material does not appear in the dropdown
- **User should:** Reactivate the raw material first (Inventory → Raw Materials → Show Inactive → Reactivate), then record the waste

---

## Examples

### Example 1: Expired Milk

Ma Thandar opens the fridge Monday morning and finds 2 bottles of milk expired over the weekend.

1. She navigates to Inventory → Waste → Record Waste
2. She selects "Whole Milk" from the dropdown
3. She enters quantity: 2000 (2 bottles × 1000ml each)
4. She selects reason: "Spoiled"
5. She adds a note: "Left in fridge over weekend, expired Sunday"
6. She clicks Save
7. Her milk stock drops by 2000ml
8. The waste report for this week shows 2000ml of milk wasted due to spoilage

**Cost impact:** At 1.5 MMK/ml, this waste cost her 3,000 MMK.

### Example 2: Spillage During Rush Hour

During a busy morning rush, a barista accidentally knocks over a pitcher of milk.

1. After the rush, Ko Zaw records the waste
2. Raw Material: Whole Milk
3. Quantity: 300 (approximately 300ml spilled)
4. Reason: Spillage
5. Notes: "Pitcher knocked over at counter during 9am rush"
6. Save

**Pattern insight:** After a month, Ko Zaw checks the waste report and sees that spillage accounts for 40% of his waste. He decides to install a shelf with raised edges to prevent pitchers from sliding off.

### Example 3: Monthly Waste Review

At the end of the month, Ko Min reviews his waste report.

**Summary:**
- Total waste cost: 45,000 MMK
- Waste as % of revenue: 2.1%
- Top wasted material: Whole Milk (60% of waste)
- Top waste reason: Spoilage (50% of waste)

**Breakdown by material:**
| Material | Wasted | Cost |
|----------|--------|------|
| Whole Milk | 15,000 ml | 22,500 MMK |
| Espresso Beans | 1,000 g | 15,000 MMK |
| Vanilla Syrup | 500 ml | 5,000 MMK |
| Cups | 25 units | 2,500 MMK |

**Actions Ko Min takes:**
1. Orders milk in smaller quantities (3 bottles every 2 days instead of 10 bottles weekly) to reduce spoilage
2. Trains staff on proper milk storage (always refrigerate immediately after opening)
3. Sets minimum stock alerts to reorder beans more frequently (prevents beans sitting too long)
4. Reviews waste report weekly instead of monthly to catch problems faster

---

## Best Practices

### Record Waste Immediately

Do not wait until the end of the day or week. Record waste as soon as it happens so:
- Your stock levels are always accurate
- You do not forget to log waste
- The system can alert you if stock gets too low due to waste

### Use Notes for Context

The "Notes" field is optional but valuable. Examples of good notes:
- "Milk left out overnight by new staff"
- "Espresso machine overflow during cleaning"
- "Customer returned — too sweet"
- "Dropped tray of cups during delivery"

Notes help you identify patterns and train staff.

### Review Waste Reports Weekly

Do not wait for the monthly report. A weekly review helps you:
- Catch problems early (e.g., one ingredient wasting unusually fast)
- Take corrective action before waste costs accumulate
- Hold staff accountable for waste patterns

### Set Waste Reduction Goals

Based on your waste report, set targets:
- Current waste: 3% of revenue
- Goal: Reduce to 1.5% within 2 months
- Actions: Smaller milk orders, better storage, staff training

Track progress in your weekly waste report review.

---

## Related Features

- [Recipe & Inventory Management](recipe-bom-user-workflow.md) — Set up raw materials and recipes (required for waste tracking)
- [Inventory Alerts](inventory-alerts.md) — Get notified when waste causes low stock
- [User Onboarding](user-onboarding.md) — Upgrade to Pro tier for waste tracking
