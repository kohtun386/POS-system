-- Fix sale_item_index to use loop position instead of non-existent JSONB field
-- The frontend CartItem type has no 'index' property, so (item->>'index')::INT
-- was always NULL. This migration replaces the trigger function with a version
-- that computes the index from a counter variable.

CREATE OR REPLACE FUNCTION deduct_raw_materials()
RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  item_index INT := 0;
  recipe_row RECORD;
  line RECORD;
  sale_product_id UUID;
  sale_quantity NUMERIC;
  total_needed NUMERIC;
  new_stock NUMERIC;
  product_rec RECORD;
  product_qty NUMERIC;
BEGIN
  -- Loop through each item in the sale's items JSONB array
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    item_index := item_index + 1;
    sale_product_id := (item->>'productId')::UUID;
    sale_quantity := COALESCE((item->>'quantity')::NUMERIC, 1);

    -- ============================================================
    -- A. DEDUCT products.stock (for inventory-tracked products)
    -- ============================================================
    SELECT * INTO product_rec
    FROM products
    WHERE id = sale_product_id
      AND track_inventory = true;

    IF FOUND THEN
      -- Determine quantity to deduct (weight-based uses weight field)
      product_qty := COALESCE((item->>'weight')::NUMERIC, sale_quantity);

      -- Check sufficient product stock
      IF product_rec.stock < product_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %: need % but have %',
          product_rec.name, product_qty, product_rec.stock;
      END IF;

      -- Deduct product stock
      UPDATE products
      SET stock = stock - product_qty,
          updated_at = now()
      WHERE id = sale_product_id;
    END IF;

    -- ============================================================
    -- B. DEDUCT raw_materials.current_stock (for products with recipes)
    -- ============================================================
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

      -- Log consumption (item_index from loop counter, not JSONB)
      INSERT INTO consumption_log (
        shop_id, sale_id, sale_item_index,
        product_id, product_name,
        raw_material_id, raw_material_name,
        quantity_consumed, quantity_base, wastage_amount, unit,
        stock_before, stock_after,
        consumed_at
      ) VALUES (
        NEW.shop_id, NEW.id, item_index,
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
$$;
