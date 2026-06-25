-- ================================================================
-- Migration: Recipe BOM + Atomic Deduction Trigger
-- Date: June 24, 2026
-- Description:
--   Creates raw_materials, recipes, recipe_lines, consumption_log,
--   and uom_conversions tables.
--   Adds atomic deduction trigger.
-- ================================================================

-- ================================================================
-- 1. TABLES: RAW MATERIALS & RECIPES
-- ================================================================

CREATE TABLE raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT NOT NULL DEFAULT 'ingredient'
    CHECK (category IN ('ingredient', 'packaging', 'consumable')),
  current_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  minimum_stock NUMERIC(12,3) DEFAULT 0,
  base_unit TEXT NOT NULL,
  cost_per_unit NUMERIC(10,4),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  serving_size NUMERIC(10,2) DEFAULT 1,
  serving_unit TEXT DEFAULT 'serving',
  prep_time_seconds INTEGER,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
  raw_material_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  recipe_unit TEXT,
  recipe_quantity NUMERIC(10,3),
  wastage_percent NUMERIC(5,2) DEFAULT 0,
  is_optional BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consumption_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  sale_id UUID NOT NULL REFERENCES sales(id),
  sale_item_index INTEGER,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id),
  raw_material_name TEXT NOT NULL,
  quantity_consumed NUMERIC(12,3) NOT NULL,
  quantity_base NUMERIC(12,3) NOT NULL,
  wastage_amount NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  stock_before NUMERIC(12,3) NOT NULL,
  stock_after NUMERIC(12,3) NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE uom_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  factor NUMERIC(12,6) NOT NULL,
  UNIQUE(from_unit, to_unit)
);

-- ================================================================
-- 2. INDEXES
-- ================================================================

CREATE INDEX idx_raw_materials_shop ON raw_materials(shop_id);
CREATE INDEX idx_raw_materials_category ON raw_materials(category);
CREATE INDEX idx_raw_materials_active ON raw_materials(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX idx_raw_materials_sku ON raw_materials(shop_id, sku) WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX idx_recipes_product ON recipes(product_id);
CREATE INDEX idx_recipes_shop ON recipes(shop_id);

CREATE INDEX idx_recipe_lines_recipe ON recipe_lines(recipe_id);
CREATE INDEX idx_recipe_lines_material ON recipe_lines(raw_material_id);
CREATE UNIQUE INDEX idx_recipe_lines_unique ON recipe_lines(recipe_id, raw_material_id);

CREATE INDEX idx_consumption_log_sale ON consumption_log(sale_id);
CREATE INDEX idx_consumption_log_material ON consumption_log(raw_material_id);
CREATE INDEX idx_consumption_log_consumed ON consumption_log(consumed_at);
CREATE INDEX idx_consumption_log_shop ON consumption_log(shop_id);
CREATE INDEX idx_consumption_log_product ON consumption_log(product_id);

-- ================================================================
-- 3. RLS POLICIES
-- ================================================================

-- Common patterns: RLS enabled + current_shop_ids() scope

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read raw_materials" ON raw_materials FOR SELECT USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()));
CREATE POLICY "Admin manage raw_materials" ON raw_materials FOR ALL USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()) AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')));

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read recipes" ON recipes FOR SELECT USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()));
CREATE POLICY "Admin manage recipes" ON recipes FOR ALL USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()) AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')));

ALTER TABLE recipe_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read recipe_lines" ON recipe_lines FOR SELECT USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()));
CREATE POLICY "Admin manage recipe_lines" ON recipe_lines FOR ALL USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()) AND EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager')));

ALTER TABLE consumption_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read consumption_log" ON consumption_log FOR SELECT USING (auth.role() = 'authenticated' AND shop_id IN (SELECT public.current_shop_ids()));

-- ================================================================
-- 4. SEED UOM CONVERSIONS
-- ================================================================

INSERT INTO uom_conversions (from_unit, to_unit, factor) VALUES
  ('l', 'ml', 1000), ('ml', 'l', 0.001), ('cup', 'ml', 236.588), ('oz', 'ml', 29.5735), ('tbsp', 'ml', 14.787), ('tsp', 'ml', 4.929),
  ('kg', 'g', 1000), ('g', 'kg', 0.001), ('oz', 'g', 28.3495), ('lb', 'g', 453.592),
  ('unit', 'unit', 1), ('piece', 'unit', 1), ('each', 'unit', 1);

-- ================================================================
-- 5. ATOMIC DEDUCTION TRIGGER
-- ================================================================

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
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    sale_product_id := (item->>'productId')::UUID;
    sale_quantity := COALESCE((item->>'quantity')::NUMERIC, 1);
    SELECT * INTO recipe_row FROM recipes WHERE product_id = sale_product_id AND is_active = true;
    IF NOT FOUND THEN CONTINUE; END IF;
    FOR line IN
      SELECT rl.*, rm.current_stock, rm.base_unit
      FROM recipe_lines rl
      JOIN raw_materials rm ON rm.id = rl.raw_material_id
      WHERE rl.recipe_id = recipe_row.id AND rl.is_optional = false
    LOOP
      total_needed := line.quantity * sale_quantity * (1 + line.wastage_percent / 100);
      IF line.current_stock < total_needed THEN
        RAISE EXCEPTION 'Insufficient stock for %: need % but have %', line.raw_material_name, total_needed, line.current_stock;
      END IF;
      new_stock := line.current_stock - total_needed;
      UPDATE raw_materials SET current_stock = new_stock, updated_at = now() WHERE id = line.raw_material_id;
      INSERT INTO consumption_log (
        shop_id, sale_id, sale_item_index, product_id, product_name, raw_material_id, raw_material_name,
        quantity_consumed, quantity_base, wastage_amount, unit, stock_before, stock_after, consumed_at
      ) VALUES (
        NEW.shop_id, NEW.id, (item->>'index')::INT, sale_product_id, recipe_row.product_name, line.raw_material_id, line.raw_material_name,
        total_needed, line.quantity * sale_quantity, total_needed - (line.quantity * sale_quantity), line.base_unit, line.current_stock, new_stock, now()
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_raw_materials AFTER INSERT ON sales FOR EACH ROW EXECUTE FUNCTION deduct_raw_materials();
