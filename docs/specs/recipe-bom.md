# Recipe Bill of Materials (BOM) — Design Specification

## Overview

A Bill of Materials system that decomposes finished products (e.g., "Cappuccino") into raw materials (e.g., "Milk", "Espresso Beans"). When a sale completes, a PostgreSQL trigger atomically deducts the consumed quantities from raw material stock — no application-level logic needed.

## Core Concept

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Product    │       │   Recipe    │       │ Raw Material │
│ "Cappuccino" │──────→│  (1 serving)│──────→│ "Milk"       │
│  $4.50       │       │             │       │  200ml/cup   │
└─────────────┘       │             │       ├─────────────┤
                      │             │──────→│ "Espresso"   │
                      │             │       │  18g/cup     │
                      └─────────────┘       └─────────────┘
```

## Database Schema

### `raw_materials`

The base ingredients and consumables tracked by quantity.

```sql
CREATE TABLE raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Identity
  name TEXT NOT NULL,                    -- "Whole Milk", "Espresso Beans (House Blend)"
  sku TEXT,                              -- optional barcode / internal code
  category TEXT NOT NULL DEFAULT 'ingredient'
    CHECK (category IN ('ingredient', 'packaging', 'consumable')),

  -- Stock tracking
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,3) DEFAULT 0, -- low-stock alert threshold

  -- Unit of Measure
  base_unit TEXT NOT NULL,               -- the unit current_stock is measured in (see UoM table)
  -- Common: 'ml', 'g', 'l', 'kg', 'unit', 'oz'

  -- Costing
  cost_per_unit NUMERIC(10,4),           -- cost per base_unit (for COGS reporting)

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_raw_materials_shop ON raw_materials(shop_id);
CREATE INDEX idx_raw_materials_category ON raw_materials(category);
CREATE INDEX idx_raw_materials_active ON raw_materials(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_raw_materials_sku ON raw_materials(shop_id, sku) WHERE sku IS NOT NULL;
```

### `recipes`

A recipe defines the BOM for one product. One product → one recipe (1:1).

```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Link to product
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,            -- denormalized for quick display

  -- Recipe metadata
  serving_size NUMERIC(10,2) DEFAULT 1,  -- yield per preparation (usually 1)
  serving_unit TEXT DEFAULT 'serving',   -- 'serving', 'cup', 'piece'
  prep_time_seconds INTEGER,             -- estimated prep time (for kitchen display)
  instructions TEXT,                      -- optional prep instructions

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_recipes_product ON recipes(product_id);
CREATE INDEX idx_recipes_shop ON recipes(shop_id);
```

### `recipe_lines`

Individual raw material requirements within a recipe.

```sql
CREATE TABLE recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Parent recipe
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- Raw material
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
  raw_material_name TEXT NOT NULL,       -- denormalized

  -- Quantity (in the raw material's base_unit)
  quantity NUMERIC(10,3) NOT NULL,       -- e.g., 200 (ml of milk per cappuccino)

  -- Optional: alternative UoM for recipe authoring convenience
  -- The trigger always converts to base_unit before deducting
  recipe_unit TEXT,                      -- e.g., 'cup' when authoring (gets converted to 'ml')
  recipe_quantity NUMERIC(10,3),         -- e.g., 1 cup (displayed in recipe editor)

  -- Wastage factor (optional)
  wastage_percent NUMERIC(5,2) DEFAULT 0, -- e.g., 5.00 = 5% extra deducted for spillage

  -- Metadata
  is_optional BOOLEAN DEFAULT false,     -- for optional ingredients (can be skipped)
  notes TEXT,                            -- "froth to 65°C", "use fresh, not UHT"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_recipe_lines_recipe ON recipe_lines(recipe_id);
CREATE INDEX idx_recipe_lines_material ON recipe_lines(raw_material_id);
CREATE UNIQUE INDEX idx_recipe_lines_unique ON recipe_lines(recipe_id, raw_material_id);
```

### `consumption_log`

Immutable audit trail of every stock deduction. Written by the trigger, never updated.

```sql
CREATE TABLE consumption_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),

  -- Source
  sale_id UUID NOT NULL REFERENCES sales(id),
  sale_item_index INTEGER,              -- which item in the sale's items array
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,

  -- Material consumed
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
  raw_material_name TEXT NOT NULL,

  -- Quantities
  quantity_consumed NUMERIC(12,3) NOT NULL,  -- actual amount deducted
  quantity_base NUMERIC(12,3) NOT NULL,      -- before wastage
  wastage_amount NUMERIC(12,3) DEFAULT 0,    -- wastage portion
  unit TEXT NOT NULL,                         -- base_unit of the raw material

  -- Stock snapshot (for reconciliation)
  stock_before NUMERIC(12,3) NOT NULL,       -- raw material stock before deduction
  stock_after NUMERIC(12,3) NOT NULL,        -- raw material stock after deduction

  -- Timestamps
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_consumption_log_sale ON consumption_log(sale_id);
CREATE INDEX idx_consumption_log_material ON consumption_log(raw_material_id);
CREATE INDEX idx_consumption_log_consumed ON consumption_log(consumed_at);
CREATE INDEX idx_consumption_log_shop ON consumption_log(shop_id);
CREATE INDEX idx_consumption_log_product ON consumption_log(product_id);
```

## Unit of Measure (UoM) Conversion

### The Problem

Stock is purchased and stored in one unit (e.g., 1 bottle = 1000ml), but recipes specify consumption in another (e.g., 200ml per cup). We need conversion so the trigger can deduct the correct amount.

### Approach: Base Unit Normalization

All stock is stored in a **base unit**. Conversions happen at recipe authoring time, not at deduction time.

```
Base units:
  Liquids  → ml  (milliliters)
  Solids   → g   (grams)
  Countable → unit (individual items)

Examples:
  Milk:      1 bottle = 1000ml   → stock = 1000, base_unit = 'ml'
  Syrup:     1 pump  = 15ml      → stock = 750,  base_unit = 'ml'
  Beans:     1 bag   = 1000g     → stock = 1000, base_unit = 'g'
  Cups:      stock = 500,         base_unit = 'unit'
```

### UoM Conversion Table

A helper table for common conversions used in the recipe editor UI (not by the trigger):

```sql
CREATE TABLE uom_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  factor NUMERIC(12,6) NOT NULL,    -- 1 from_unit = factor to_units
  UNIQUE(from_unit, to_unit)
);

-- Seed common conversions
INSERT INTO uom_conversions (from_unit, to_unit, factor) VALUES
  -- Volume
  ('l', 'ml', 1000),
  ('ml', 'l', 0.001),
  ('cup', 'ml', 236.588),
  ('oz', 'ml', 29.5735),
  ('tbsp', 'ml', 14.787),
  ('tsp', 'ml', 4.929),

  -- Weight
  ('kg', 'g', 1000),
  ('g', 'kg', 0.001),
  ('oz', 'g', 28.3495),
  ('lb', 'g', 453.592),

  -- Countable (1:1)
  ('unit', 'unit', 1),
  ('piece', 'unit', 1),
  ('each', 'unit', 1);
```

### Conversion Logic in Application Layer

When creating/editing a recipe line, the UI allows entering quantity in any unit. The service converts to the raw material's base_unit before saving:

```typescript
// src/lib/uomUtils.ts
export class UomConverter {
  private conversions: Map<string, number>;  // "from→to" → factor

  constructor(rows: UomConversion[]) {
    this.conversions = new Map(
      rows.map(r => [`${r.fromUnit}→${r.toUnit}`, r.factor])
    );
  }

  convert(quantity: number, fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return quantity;

    const factor = this.conversions.get(`${fromUnit}→${toUnit}`);
    if (factor === undefined) {
      throw new Error(`No conversion from ${fromUnit} to ${toUnit}`);
    }

    return quantity * factor;
  }

  // Convenience: convert recipe quantity to base unit
  toBaseUnit(quantity: number, recipeUnit: string, baseUnit: string): number {
    return this.convert(quantity, recipeUnit, baseUnit);
  }
}

// Usage in recipe line creation
const convertedQty = converter.toBaseUnit(
  1,        // recipe_quantity
  'cup',    // recipe_unit
  'ml'      // raw_material.base_unit
);
// → 236.588 ml stored in recipe_lines.quantity
```

### Stock Entry Flexibility

When restocking raw materials, staff can enter quantity in any unit — converted to base_unit on save:

```
User enters:  2 bottles of syrup (1 bottle = 750ml)
App converts: 2 × 750 = 1500ml
DB stores:    current_stock += 1500 (in ml)
```

## Atomic Deduction Trigger

### Design Principle

The deduction must be **atomic** — if a sale contains 5 items each requiring milk, all 5 deductions happen in a single transaction. If any deduction fails (insufficient stock), the entire sale rolls back.

### Trigger Function

```sql
-- This trigger fires AFTER a sale is inserted into the sales table
CREATE OR REPLACE FUNCTION deduct_raw_materials()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  recipe_row RECORD;
  line RECORD;
  sale_product_id UUID;
  sale_quantity NUMERIC;
  total_needed NUMERIC;
  new_stock NUMERIC;
BEGIN
  -- Loop through each item in the sale's items JSONB array
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    sale_product_id := (item->>'productId')::UUID;
    sale_quantity := COALESCE((item->>'quantity')::NUMERIC, 1);

    -- Find the recipe for this product
    SELECT * INTO recipe_row
    FROM recipes
    WHERE product_id = sale_product_id
      AND is_active = true;

    -- Skip if no recipe defined (non-food item, service charge, etc.)
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Deduct each raw material in the recipe
    FOR line IN
      SELECT rl.*, rm.current_stock, rm.base_unit
      FROM recipe_lines rl
      JOIN raw_materials rm ON rm.id = rl.raw_material_id
      WHERE rl.recipe_id = recipe_row.id
        AND rl.is_optional = false
    LOOP
      -- Calculate total needed (recipe qty × sale qty × (1 + wastage%))
      total_needed := line.quantity * sale_quantity * (1 + line.wastage_percent / 100);

      -- Check sufficient stock
      IF line.current_stock < total_needed THEN
        RAISE EXCEPTION 'Insufficient stock for %: need % but have %',
          line.raw_material_name,
          total_needed,
          line.current_stock;
      END IF;

      -- Deduct stock
      new_stock := line.current_stock - total_needed;

      UPDATE raw_materials
      SET current_stock = new_stock,
          updated_at = now()
      WHERE id = line.raw_material_id;

      -- Log consumption
      INSERT INTO consumption_log (
        shop_id, sale_id, sale_item_index,
        product_id, product_name,
        raw_material_id, raw_material_name,
        quantity_consumed, quantity_base, wastage_amount, unit,
        stock_before, stock_after,
        consumed_at
      ) VALUES (
        NEW.shop_id, NEW.id, (item->>'index')::INT,
        sale_product_id, recipe_row.product_name,
        line.raw_material_id, line.raw_material_name,
        total_needed, line.quantity * sale_quantity,
        total_needed - (line.quantity * sale_quantity),
        line.base_unit,
        line.current_stock, new_stock,
        now()
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to sales table
CREATE TRIGGER trg_deduct_raw_materials
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION deduct_raw_materials();
```

### Trigger Flow

```
Sale INSERT (items: [{productId: X, qty: 2}, {productId: Y, qty: 1}])
│
├─ For item X (qty: 2):
│   ├─ Find recipe for product X
│   ├─ Recipe line: Milk, 200ml per serving, 5% wastage
│   │   ├─ total_needed = 200 × 2 × 1.05 = 420ml
│   │   ├─ Check: current_stock (5000ml) >= 420ml ✓
│   │   ├─ UPDATE raw_materials SET current_stock = 4580
│   │   └─ INSERT INTO consumption_log (420ml deducted)
│   │
│   ├─ Recipe line: Espresso, 18g per serving, 0% wastage
│   │   ├─ total_needed = 18 × 2 × 1.0 = 36g
│   │   ├─ Check: current_stock (2000g) >= 36g ✓
│   │   ├─ UPDATE raw_materials SET current_stock = 1964g
│   │   └─ INSERT INTO consumption_log (36g deducted)
│   │
│   └─ Recipe line: Cup, 1 per serving
│       ├─ total_needed = 1 × 2 = 2
│       ├─ Check: current_stock (500) >= 2 ✓
│       ├─ UPDATE raw_materials SET current_stock = 498
│       └─ INSERT INTO consumption_log (2 deducted)
│
├─ For item Y (qty: 1):
│   └─ (same pattern...)
│
└─ RETURN NEW (sale committed)
```

### Rollback Behavior

If **any** raw material has insufficient stock, the `RAISE EXCEPTION` rolls back the entire transaction:

- The sale is NOT created
- No stock is deducted
- No consumption log entries are written
- The POS shows an error: "Insufficient stock for Milk: need 420ml but have 300ml"

This is **intentionally strict** — partial sales are not allowed. The POS must check stock availability before checkout (see Integration below).

## Pre-Checkout Stock Validation

To avoid checkout failures, the POS validates stock availability **before** submitting the sale:

```typescript
// src/lib/inventoryUtils.ts
export interface StockCheckResult {
  sufficient: boolean;
  insufficientItems: Array<{
    productName: string;
    rawMaterialName: string;
    needed: number;
    available: number;
    unit: string;
  }>;
}

export async function checkStockAvailability(
  cartItems: CartItem[],
  shopId: string
): Promise<StockCheckResult> {
  const insufficientItems: StockCheckResult['insufficientItems'] = [];

  for (const item of cartItems) {
    const recipe = await recipesService.getByProductId(item.productId);
    if (!recipe) continue; // no recipe = no stock check needed

    const lines = await recipeLinesService.getByRecipeId(recipe.id);

    for (const line of lines) {
      if (line.isOptional) continue;

      const needed = line.quantity * item.quantity * (1 + line.wastagePercent / 100);
      const material = await rawMaterialsService.getById(line.rawMaterialId);

      if (material.currentStock < needed) {
        insufficientItems.push({
          productName: item.name,
          rawMaterialName: material.name,
          needed,
          available: material.currentStock,
          unit: material.baseUnit,
        });
      }
    }
  }

  return {
    sufficient: insufficientItems.length === 0,
    insufficientItems,
  };
}
```

## Services

### `rawMaterialsService`

```typescript
export const rawMaterialsService = {
  getAll(filters?: { category?: string; active?: boolean }): Promise<RawMaterial[]>,
  getById(id: string): Promise<RawMaterial>,
  create(data: CreateRawMaterialInput): Promise<RawMaterial>,
  update(id: string, data: Partial<RawMaterial>): Promise<RawMaterial>,
  delete(id: string): Promise<void>,
  restock(id: string, quantity: number, unit?: string): Promise<RawMaterial>,
  getLowStock(): Promise<RawMaterial[]>,  // current_stock <= minimum_stock
}
```

### `recipesService`

```typescript
export const recipesService = {
  getAll(): Promise<Recipe[]>,
  getByProductId(productId: string): Promise<Recipe | null>,
  create(data: CreateRecipeInput): Promise<Recipe>,
  update(id: string, data: Partial<Recipe>): Promise<Recipe>,
  delete(id: string): Promise<void>,
  duplicate(recipeId: string, newProductId: string): Promise<Recipe>,
}
```

### `recipeLinesService`

```typescript
export const recipeLinesService = {
  getByRecipeId(recipeId: string): Promise<RecipeLine[]>,
  create(data: CreateRecipeLineInput): Promise<RecipeLine>,
  update(id: string, data: Partial<RecipeLine>): Promise<RecipeLine>,
  delete(id: string): Promise<void>,
  bulkReplace(recipeId: string, lines: CreateRecipeLineInput[]): Promise<RecipeLine[]>,
}
```

### `consumptionLogService`

```typescript
export const consumptionLogService = {
  getBySaleId(saleId: string): Promise<ConsumptionLog[]>,
  getByMaterialId(materialId: string, period?: DateRange): Promise<ConsumptionLog[]>,
  getSummary(period?: DateRange): Promise<ConsumptionSummary>,
  // Summary: total cost, by material, by product, wastage totals
}
```

## RLS Policies

```sql
-- raw_materials: shop-scoped access via current_shop_ids()
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members read raw_materials" ON raw_materials FOR SELECT
  USING (shop_id = ANY(current_shop_ids()));
CREATE POLICY "Admin manage raw_materials" ON raw_materials FOR ALL
  USING (shop_id = ANY(current_shop_ids()))
  WITH CHECK (shop_id = ANY(current_shop_ids()));

-- recipes: same pattern
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop members read recipes" ON recipes FOR SELECT
  USING (shop_id = ANY(current_shop_ids()));
CREATE POLICY "Admin manage recipes" ON recipes FOR ALL
  USING (shop_id = ANY(current_shop_ids()))
  WITH CHECK (shop_id = ANY(current_shop_ids()));

-- recipe_lines: inherit from recipes (same roles)
ALTER TABLE recipe_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read recipe_lines" ON recipe_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage recipe_lines" ON recipe_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')));

-- consumption_log: read-only for authenticated, no updates/deletes (immutable)
ALTER TABLE consumption_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read consumption_log" ON consumption_log FOR SELECT USING (auth.role() = 'authenticated');
```

## Permissions

| Action | Admin | Manager | Cashier |
|--------|-------|---------|---------|
| View raw materials | ✓ | ✓ | ✓ |
| Manage raw materials | ✓ | ✓ | ✗ |
| View recipes | ✓ | ✓ | ✓ |
| Manage recipes | ✓ | ✓ | ✗ |
| View consumption log | ✓ | ✓ | ✗ |
| Manual stock adjustment | ✓ | ✓ | ✗ |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/xxx_create_raw_materials.sql` | Create | raw_materials table |
| `supabase/migrations/xxx_create_recipes.sql` | Create | recipes + recipe_lines tables |
| `supabase/migrations/xxx_create_consumption_log.sql` | Create | consumption_log table |
| `supabase/migrations/xxx_create_uom_conversions.sql` | Create | uom_conversions table + seed |
| `supabase/migrations/xxx_create_deduction_trigger.sql` | Create | deduct_raw_materials() trigger |
| `src/types/index.ts` | Modify | Add RawMaterial, Recipe, RecipeLine, ConsumptionLog types |
| `src/lib/services.ts` | Modify | Add rawMaterialsService, recipesService, recipeLinesService, consumptionLogService |
| `src/lib/uomUtils.ts` | Create | UomConverter class |
| `src/lib/inventoryUtils.ts` | Modify | Add checkStockAvailability() |
| `src/components/recipes/RecipeManager.tsx` | Create | Recipe list + editor |
| `src/components/recipes/RecipeForm.tsx` | Create | Recipe creation/editing form |
| `src/components/inventory/RawMaterialManager.tsx` | Create | Raw materials list + restock |
| `src/components/reports/ConsumptionReport.tsx` | Create | Consumption analytics |
| `src/components/pos/CheckoutModal.tsx` | Modify | Pre-checkout stock validation |
