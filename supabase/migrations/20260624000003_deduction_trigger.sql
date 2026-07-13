-- ================================================================
-- Migration: Atomic Product Stock Deduction Trigger
-- Date: June 25, 2026
-- Description:
--   Deducts products.stock atomically on sale INSERT.
--   Replaces the app-level stock update loop in CheckoutModal.tsx.
--   Recipe/raw-material deduction removed (v3.1.0 out of scope).
-- ================================================================

-- ================================================================
-- 1. TRIGGER FUNCTION: deduct_product_stock()
-- ================================================================

CREATE OR REPLACE FUNCTION deduct_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  sale_product_id UUID;
  sale_quantity NUMERIC;
  product_rec RECORD;
  product_qty NUMERIC;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    sale_product_id := (item->>'productId')::UUID;
    sale_quantity := COALESCE((item->>'quantity')::NUMERIC, 1);

    SELECT * INTO product_rec
    FROM products
    WHERE id = sale_product_id
      AND track_inventory = true;

    IF FOUND THEN
      product_qty := COALESCE((item->>'weight')::NUMERIC, sale_quantity);

      IF product_rec.stock < product_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %: need % but have %',
          product_rec.name, product_qty, product_rec.stock;
      END IF;

      UPDATE products
      SET stock = stock - product_qty,
          updated_at = now()
      WHERE id = sale_product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 2. CREATE TRIGGER (idempotent)
-- ================================================================

DROP TRIGGER IF EXISTS trg_deduct_product_stock ON sales;
DROP TRIGGER IF EXISTS trg_deduct_raw_materials ON sales;

CREATE TRIGGER trg_deduct_product_stock
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION deduct_product_stock();
