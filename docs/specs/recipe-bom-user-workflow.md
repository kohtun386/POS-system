# Recipe & Inventory Management — User Workflow Guide

## Overview

Recipe and inventory management lets you track raw materials (like milk, coffee beans, and cups), create recipes that link raw materials to your menu items, and automatically deduct ingredients when you make a sale. This means you always know what you have in stock, what each drink costs to make, and when to reorder.

## Tier Access

| Tier | Access Level | Notes |
|------|-------------|-------|
| Free | Basic product stock tracking only | Can toggle "Track Inventory" on products for simple counts. No raw materials, no recipes, no auto-deduction, no COGS. Upgrade prompts appear when accessing inventory features. |
| Growth | Full recipe & inventory management | Raw materials, recipes, auto-deduction on sale, low stock alerts, COGS reports. |
| Pro | Everything in Growth + profit analytics | Profit margin per product, waste tracking, daily P&L dashboard. |

---

## Step-by-Step Workflow

### For Free Tier Users

Free tier shops can track basic product stock (e.g., "we have 25 Cappuccinos ready"), but cannot track raw materials or recipes.

1. **Enable stock tracking on a product**
   - Navigate to: **Inventory → Products**
   - Click: **Edit** on a product
   - Toggle: **Track Inventory** to ON
   - Fill in: **Current Stock** (e.g., 25) and **Minimum Stock** (e.g., 5)
   - Click: **Save**
   - System response: The product now shows stock levels on the POS grid. When stock reaches 0, the product shows "Out of Stock."

2. **What you cannot do (upgrade prompts)**
   - When you try to access **Inventory → Raw Materials**, you see: *"Raw material tracking is available on Growth and Pro plans. Upgrade to track ingredients, create recipes, and auto-deduct stock on every sale."*
   - When you try to access **Recipes**, you see: *"Recipe management is available on Growth and Pro plans. Upgrade to define ingredient lists and calculate cost of goods sold."*

---

### For Growth Tier Users

Growth tier unlocks the full inventory workflow: raw materials, recipes, automatic deductions, and cost tracking.

#### Step 1: Set Up Raw Materials

Before creating recipes, you need to tell the system what ingredients and supplies you use.

1. **Navigate to:** Inventory → Raw Materials
2. **Click:** "Add Raw Material"
3. **Fill in the form:**
   - **Name:** e.g., "Whole Milk"
   - **Category:** Select one:
     - *Ingredient* — things that go into drinks/food (milk, coffee beans, sugar)
     - *Packaging* — cups, lids, straws, bags
     - *Consumable* — napkins, stirrers, cleaning supplies
   - **Base Unit:** How you measure this item:
     - *ml* (milliliters) — for liquids like milk, syrup
     - *g* (grams) — for solids like coffee beans, sugar
     - *unit* (individual items) — for countable things like cups, lids
   - **Cost Per Unit:** How much one base unit costs (e.g., 1.5 MMK per ml of milk)
   - **Current Stock:** How much you have right now (e.g., 5000 ml)
   - **Minimum Stock:** When to alert you for reorder (e.g., 1000 ml)
4. **Click:** "Save"
5. **System response:** The raw material appears in your list with its current stock level.

**Repeat** for every ingredient and supply you use. Common items to add:

*For drinks:*
- Coffee beans (g)
- Milk (ml)
- Sugar (g)
- Syrups — vanilla, caramel, etc. (ml)
- Tea leaves (g)
- Cups — small, medium, large (unit)
- Lids (unit)
- Straws (unit)
- Napkins (unit)

*For food (if your shop serves snacks or light meals):*
- Rice noodles (g) — for မုန့်ဟင်းခါး (Mohinga)
- Flour (g) — for cakes, cookies, bread
- Vegetables — lettuce, tomato, onion (g)
- Meat — chicken, fish, pork (g)
- Eggs (unit)
- Cooking oil (ml)
- Spices — chili powder, turmeric, paprika (g)
- Bread slices (unit) — for sandwiches
- Cheese (g)
- Butter (g)

#### Step 2: Restock Raw Materials

When you purchase new supplies, update your stock levels.

1. **Navigate to:** Inventory → Raw Materials
2. **Find:** The material you just purchased
3. **Click:** "Restock"
4. **Fill in:**
   - **Quantity:** How much you bought (e.g., 2 bottles of milk)
   - **Unit:** The unit you purchased in (e.g., "bottle" — the system converts to base unit automatically. If 1 bottle = 1000ml, entering 2 bottles adds 2000ml to stock.)
5. **Click:** "Confirm Restock"
6. **System response:** Stock level updates. You can see the new amount in the raw materials list.

#### Step 3: Create a Recipe

A recipe tells the system which raw materials go into each menu item and how much of each.

1. **Navigate to:** Recipes
2. **Click:** "Create Recipe"
3. **Select the product** from the dropdown (e.g., "Cappuccino")
4. **Add recipe lines** — one line per ingredient:
   - Click "Add Ingredient"
   - **Select raw material:** e.g., "Espresso Beans"
   - **Quantity per serving:** e.g., 18
   - **Unit:** e.g., "g" (grams)
   - **Wastage %:** Optional. If you typically spill or waste 5% of this ingredient, enter 5. The system will deduct 5% extra to account for this.
   - **Notes:** Optional. e.g., "Use house blend"
   - Click "Add" to save the line
5. **Repeat** for each ingredient in the recipe:
   - Milk: 200 ml
   - Sugar: 5 g
   - Cup: 1 unit
   - Lid: 1 unit
6. **Click:** "Save Recipe"
7. **System response:** The recipe is now linked to the product. Every time this product is sold, the system will automatically deduct these ingredients from your raw material stock.

**Example — Cappuccino Recipe:**

| Ingredient | Quantity | Unit | Wastage |
|-----------|----------|------|---------|
| Espresso Beans | 18 | g | 0% |
| Whole Milk | 200 | ml | 5% |
| Sugar | 5 | g | 0% |
| Cup (Medium) | 1 | unit | 0% |
| Lid (Medium) | 1 | unit | 0% |

**What this means:** Every Cappuccino sold deducts 18g of beans, 210ml of milk (200ml + 5% wastage), 5g of sugar, 1 cup, and 1 lid from your stock.

**Example — Chicken Sandwich Recipe (food item):**

| Ingredient | Quantity | Unit | Wastage |
|-----------|----------|------|---------|
| Bread slices | 2 | unit | 0% |
| Chicken breast (cooked) | 80 | g | 10% |
| Lettuce | 15 | g | 15% |
| Tomato | 30 | g | 10% |
| Mayonnaise | 10 | g | 0% |
| Butter | 5 | g | 0% |

**What this means:** Every sandwich sold deducts 2 slices of bread, 88g of chicken (80g + 10% wastage for trimming), 17g of lettuce (15g + 15% wastage for outer leaves), 33g of tomato (30g + 10% wastage for cores), 10g mayo, and 5g butter.

**Note on food wastage:** Food ingredients often have higher wastage than drink ingredients. Lettuce has outer leaves to discard, chicken has fat and bones to trim, tomatoes have cores. Set wastage % generously to keep your stock counts accurate.

#### Step 4: Sell a Product (Auto-Deduction Happens)

Once a recipe is set up, selling the product is automatic. You do not need to do anything special.

1. **Navigate to:** POS Terminal
2. **Add products to cart** as usual
3. **Complete checkout**
4. **System response (behind the scenes):**
   - The sale is recorded
   - For each item sold, the system finds its recipe
   - Each ingredient is deducted from raw material stock
   - A consumption log entry is created (for COGS tracking)
   - If any ingredient has insufficient stock, the checkout is blocked with an error

**What you see if stock is insufficient:**
> *"Insufficient stock for Whole Milk: need 420ml but have 300ml. Please restock before completing this sale."*

The entire sale is blocked — not just the one item. This prevents selling products you cannot make.

#### Step 5: View Inventory Levels

1. **Navigate to:** Inventory → Raw Materials
2. **See:** A list of all raw materials with:
   - Current stock level
   - Minimum stock threshold
   - Status indicators:
     - 🟢 **Green:** Stock is above minimum
     - 🟡 **Yellow/Amber:** Stock is at or near minimum — time to reorder
     - 🔴 **Red:** Stock is zero — you cannot make products that use this ingredient

#### Step 6: Respond to Low Stock Alerts

When a raw material drops to or below its minimum stock level:

1. **You receive an alert** (if configured — email or SMS)
2. **Navigate to:** Inventory → Raw Materials
3. **Filter by:** "Low Stock" to see only items that need attention
4. **For each low-stock item:**
   - Click "Restock"
   - Enter the quantity you purchased
   - Click "Confirm Restock"

**Setting up automatic alerts (optional):**
- Navigate to: Settings → Alert Configuration
- Add recipients (who should receive alerts)
- Choose alert type: "Low Stock"
- Set how often to check (e.g., every hour)
- Choose delivery method: Email, SMS, or both

#### Step 7: View COGS Reports

COGS = Cost of Goods Sold. This tells you how much each product costs to make.

1. **Navigate to:** Reports → Consumption
2. **Select:** Date range (e.g., "This Week")
3. **See:**
   - Total cost of all ingredients consumed
   - Breakdown by product (e.g., Cappuccinos cost 570 MMK each to make)
   - Breakdown by raw material (e.g., you used 50,000ml of milk this week)
   - Wastage amounts (how much extra was deducted due to wastage %)

**Use this to:**
- Understand your true profit margins
- Identify which products are most/least profitable
- Spot unusual consumption (potential waste or theft)

---

### For Pro Tier Users

Pro tier adds profit margin analytics and waste tracking on top of everything Growth offers.

#### Profit Margin Analytics

1. **Navigate to:** Reports → Profit Margins
2. **See for each product:**
   - Selling price
   - Cost to make (COGS from recipe)
   - Profit per unit
   - Profit margin percentage
3. **Use this to:**
   - Identify your most profitable items
   - Decide which products to promote
   - Adjust pricing for better margins

#### Waste Tracking

See the [Waste Tracking User Workflow](waste-tracking.md) for detailed instructions.

---

## UI Screens

### Raw Materials List

- **Location:** Inventory → Raw Materials
- **Purpose:** View and manage all ingredients and supplies
- **Key Elements:**
  - **Search bar:** Filter by name
  - **Category tabs:** All / Ingredients / Packaging / Consumables
  - **Stock status filter:** All / Low Stock / Out of Stock
  - **Material card:** Shows name, category, current stock, minimum stock, cost per unit, status indicator
- **User Actions:**
  - "Add Raw Material" → Opens creation form
  - "Restock" → Opens restock dialog with unit conversion
  - "Edit" → Opens edit form
  - "Deactivate" → Hides from active list (does not delete history)

### Recipe Editor

- **Location:** Recipes → Select a recipe → Edit
- **Purpose:** Define which ingredients go into a product
- **Key Elements:**
  - **Product selector:** Which product this recipe is for
  - **Recipe lines table:** Each row is one ingredient with quantity, unit, wastage %
  - **Total cost display:** Shows calculated COGS per serving based on current ingredient costs
  - **Instructions field:** Optional preparation notes
- **User Actions:**
  - "Add Ingredient" → Opens ingredient selector
  - "Remove" on a line → Removes that ingredient from recipe
  - "Save" → Saves the recipe

### Consumption Report

- **Location:** Reports → Consumption
- **Purpose:** See what ingredients were used and their costs
- **Key Elements:**
  - **Date range picker:** Select period to analyze
  - **Summary cards:** Total COGS, total wastage, number of sales
  - **By-product table:** COGS breakdown per product
  - **By-material table:** Usage breakdown per raw material
- **User Actions:**
  - Change date range → Report updates
  - Export → Download as CSV

### Batch Production Log

- **Location:** Inventory → Batch Production
- **Purpose:** Record batch-cooked items (soups, broths, marinated meats, sauces) that are prepared in bulk and then used as ingredients in individual servings
- **Key Elements:**
  - **Batch product list:** Shows all batch items with current stock (how many servings remain)
  - **"Record Batch" button:** Opens the batch recording form
  - **Batch history:** Log of every batch produced (date, quantity made, ingredients used, who recorded it)
  - **Stock level:** How many servings of each batch item are currently available
- **User Actions:**
  - "Record Batch" → Opens form to log a new batch production
    - Select the batch product (e.g., "Mohinga Broth", "Marinated Chicken")
    - Enter quantity produced (e.g., 25 servings)
    - System deducts raw material ingredients automatically
    - Batch product stock increases by the quantity produced
  - Click a batch item → View batch history and remaining stock
  - "Adjust Stock" → Manually correct stock if physical count differs

---

## Error Handling

### "Insufficient stock" at checkout

- **When it happens:** A customer orders a product, but one or more ingredients are out of stock
- **User sees:** *"Insufficient stock for [Ingredient Name]: need [X] [unit] but have [Y] [unit]. Please restock before completing this sale."*
- **User should:** Restock the ingredient, or remove the product from the cart and offer an alternative

### "No recipe defined" warning

- **When it happens:** A product is sold but has no recipe linked to it
- **User sees:** No error — the sale goes through, but no ingredients are deducted
- **User should:** Create a recipe for the product so ingredients are tracked automatically

### "Cannot restock — invalid quantity"

- **When it happens:** Entering zero or a negative number in the restock dialog
- **User sees:** *"Please enter a positive quantity."*
- **User should:** Enter the actual quantity purchased

### Low stock alert not sending

- **When it happens:** Alert is configured but no notifications arrive
- **User sees:** No alert in email/SMS
- **User should:** Check Settings → Alert Configuration → verify the recipient email/phone is correct, the alert type is "Low Stock," and the notification service (SendGrid/Twilio) is configured with valid credentials

---

## Examples

### Example 1: Setting Up a New Coffee Shop's Inventory

Ko Htun opens a new coffee shop and needs to set up inventory tracking.

1. He adds raw materials: Espresso Beans (1000g bag, 15,000 MMK), Whole Milk (1000ml bottle, 2,500 MMK), Sugar (1000g bag, 3,000 MMK), Medium Cups (pack of 50, 5,000 MMK), Medium Lids (pack of 50, 3,000 MMK).
2. He restocks each with his current inventory: 5 bags of beans, 10 bottles of milk, 3 bags of sugar, 10 packs of cups, 10 packs of lids.
3. He creates recipes for each menu item:
   - **Cappuccino:** 18g beans, 200ml milk, 5g sugar, 1 cup, 1 lid
   - **Latte:** 18g beans, 300ml milk, 5g sugar, 1 cup, 1 lid
   - **Americano:** 18g beans, 1 cup, 1 lid (no milk)
4. He sells 10 Cappuccinos. The system automatically deducts: 180g beans, 2100ml milk (includes 5% wastage), 50g sugar, 10 cups, 10 lids.
5. He checks Reports → Consumption and sees his COGS for the day.

### Example 2: Handling a Low Stock Alert

At 2 PM, the system detects that milk is below the minimum threshold.

1. The owner receives an SMS: *"Low stock alert: Whole Milk is at 800ml (minimum: 1000ml)."*
2. The owner navigates to Inventory → Raw Materials and filters by "Low Stock."
3. Whole Milk shows with a yellow/amber indicator.
4. The owner calls the supplier and orders 10 bottles of milk.
5. When delivered, the owner clicks "Restock" on Whole Milk, enters "10 bottles," and confirms.
6. Stock updates to 10,800ml. The alert clears.

### Example 3: Discovering a Profitable Product

A shop owner checks the Profit Margins report (Pro tier).

1. Cappuccino: sells for 2,500 MMK, costs 570 MMK to make → 77% margin
2. Latte: sells for 3,000 MMK, costs 720 MMK to make → 76% margin
3. Fruit Smoothie: sells for 4,000 MMK, costs 2,800 MMK to make → 30% margin

The owner decides to promote Cappuccinos and Lattes more heavily, and considers raising the price of the Smoothie or finding cheaper fruit suppliers.

### Example 4: Setting Up a Tea Shop with Food

Ma Thandar runs a Myanmar tea shop. She sells drinks (tea, coffee, mocha) and light food (Mohinga, sandwiches, cakes, cookies). Here is how she sets up her inventory.

#### Adding Raw Materials for Food

She starts by adding all her raw materials:

**Drink ingredients:** Tea leaves, coffee beans, condensed milk, evaporated milk, sugar, cocoa powder.

**Food ingredients:** Rice noodles, fish paste, chickpea flour, onion, garlic, ginger, turmeric, chili powder, cooking oil, eggs, chicken breast, lettuce, tomato, bread, butter, mayonnaise, flour, sugar, butter, baking powder, chocolate chips.

**Packaging:** Cups (small, medium), lids, straws, plastic bags, takeaway containers.

#### Creating a Mohinga Recipe (Batch-Cooked Dish)

Mohinga (မုန့်ဟင်းခါး) is Myanmar's national breakfast dish — a fish-based rice noodle soup. It is cooked in large batches (one pot serves 20-30 bowls), not one bowl at a time.

**The batch cooking challenge:** You cannot create a recipe that says "1 bowl of Mohinga uses 50g of fish paste" because you do not cook one bowl at a time. You cook a whole pot, then serve from it.

**How to handle this:**

1. **Create raw materials for the batch ingredients:**
   - Fish paste: 500g per batch
   - Chickpea flour: 200g per batch
   - Onion: 300g per batch
   - Garlic: 50g per batch
   - Ginger: 30g per batch
   - Turmeric: 10g per batch
   - Chili powder: 15g per batch
   - Cooking oil: 100ml per batch

2. **Record the batch production** (see "Batch Production Log" in UI Screens below):
   - Navigate to: Inventory → Batch Production
   - Click: "Record Batch"
   - Select: "Mohinga Broth (batch)"
   - Enter: Quantity made (e.g., 25 servings)
   - The system deducts the batch ingredients from raw materials
   - The batch product now has 25 servings in stock

3. **Create a recipe for "1 bowl of Mohinga":**
   - Mohinga Broth (batch): 1 serving (from the batch product)
   - Rice noodles: 150g
   - Egg (hard-boiled): 1 unit
   - Fried onion garnish: 10g

Now when you sell a bowl of Mohinga at the POS, the system deducts 1 serving of broth, 150g of noodles, 1 egg, and 10g of garnish. The broth itself was already deducted from raw materials when you recorded the batch.

#### Creating a Chicken Sandwich Recipe (Assembly Food)

Sandwiches are assembled from pre-prepared components. The chicken is marinated and cooked in advance, then sliced for sandwiches.

1. **Record the batch of cooked chicken:**
   - Navigate to: Inventory → Batch Production
   - Record: "Marinated Chicken (batch)" — cooked 2kg of chicken breast
   - Raw materials deducted: 2000g chicken breast, 200ml soy sauce, 50g garlic, 30g ginger, 15g chili powder

2. **Create the sandwich recipe:**
   - Bread slices: 2 unit
   - Marinated Chicken (batch): 80g (sliced)
   - Lettuce: 15g
   - Tomato: 30g
   - Mayonnaise: 10g
   - Butter: 5g

#### Simple Snacks: Cookies

Some items have simple, direct recipes with no batch cooking:

**Chocolate Chip Cookies recipe:**
- Flour: 30g
- Butter: 15g
- Sugar: 10g
- Egg: 0.25 unit (1 egg makes 4 cookies)
- Chocolate chips: 10g

**Note on fractional quantities:** The system supports decimals. If 1 egg makes 4 cookies, each cookie uses 0.25 eggs. The system handles this correctly.

#### Ma Thandar's Full Menu

After setup, her menu and recipes look like this:

| Product | Recipe Summary | COGS |
|---------|---------------|------|
| Mohinga (bowl) | 1 broth serving + 150g noodles + 1 egg + garnish | 850 MMK |
| Chicken Sandwich | 2 bread + 80g chicken + lettuce/tomato/mayo/butter | 620 MMK |
| Chocolate Chip Cookie | flour/butter/sugar/egg/chocolate | 180 MMK |
| Sweet Tea | tea leaves + condensed milk + sugar | 150 MMK |
| Coffee | coffee beans + condensed milk + sugar | 200 MMK |

She checks Reports → Consumption and sees that Mohinga has the best margin (sells for 2,000 MMK, costs 850 MMK — 57% profit), while cookies are less profitable due to butter and chocolate costs.

---

## Related Features

- [Waste Tracking](waste-tracking.md) — Track spoiled or wasted ingredients (Pro tier)
- [Inventory Alerts](inventory-alerts.md) — Set up automatic low-stock notifications
- [User Onboarding](user-onboarding.md) — First-time setup guide for new shops
