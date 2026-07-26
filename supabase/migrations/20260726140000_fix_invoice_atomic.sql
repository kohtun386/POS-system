-- Migration: Fix invoice number generation and ensure shop‑scoped uniqueness
-- ---------------------------------------------------------------
-- 1. Fix the unique constraint for multi‑tenant isolation
-- ---------------------------------------------------------------
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;
ALTER TABLE sales ADD CONSTRAINT sales_invoice_number_key UNIQUE (shop_id, invoice_number);

-- ---------------------------------------------------------------
-- 2. Bump the invoice_counter for the affected shop (skip used numbers)
-- ---------------------------------------------------------------
UPDATE app_settings
SET invoice_counter = 1002
WHERE shop_id = (SELECT id FROM shops WHERE email = 'cele@coffee.com');

-- ---------------------------------------------------------------
-- 3. Helper: atomically read AND increment the counter at the start of the transaction
--    (replaces the previous generate_invoice_number implementation)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_invoice_number(p_shop_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice TEXT;
BEGIN
    -- Lock the app_settings row for this shop to prevent race conditions
    SELECT invoice_prefix, invoice_counter
    INTO prefix, counter
    FROM app_settings
    WHERE shop_id = p_shop_id
    FOR UPDATE;

    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;

    new_invoice := prefix || '-' || LPAD(counter::TEXT, 6, '0');

    -- Increment the counter – this write will NOT be rolled back if later steps fail
    UPDATE app_settings
    SET invoice_counter = counter + 1,
        updated_at = now()
    WHERE shop_id = p_shop_id;

    RETURN new_invoice;
END;
$$;

-- ---------------------------------------------------------------
-- 4. Rewrite the checkout_complete RPC to use the new helper
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_complete(
  p_shop_id UUID,
  p_sale_data JSONB,
  p_payments JSONB,
  p_cashier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_customer_id UUID;
  v_total NUMERIC;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_customer_total NUMERIC;
  v_daily_limit INT;
  v_daily_count INT;
  v_cashier_name TEXT;
BEGIN
  -- Validation (daily limit, cashier existence, etc.)
  SELECT daily_order_limit INTO v_daily_limit FROM shops WHERE id = p_shop_id;
  IF v_daily_limit IS NOT NULL AND v_daily_limit > 0 THEN
    SELECT COUNT(*) INTO v_daily_count FROM sales WHERE created_at >= date_trunc('day', now()) AND cashier = (SELECT name FROM users WHERE id = p_cashier_id);
    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
    END IF;
  END IF;

  -- Reserve the invoice number **before** any other work
  v_invoice := reserve_invoice_number(p_shop_id);

  v_customer_id := (p_sale_data->>'customerId')::UUID;
  v_total := (p_sale_data->>'total')::NUMERIC;

  SELECT name INTO v_cashier_name FROM users WHERE id = p_cashier_id;
  IF v_cashier_name IS NULL THEN v_cashier_name := 'Unknown'; END IF;

  INSERT INTO sales (
    id, shop_id, invoice_number, customer_id, customer_name,
    items, subtotal, discount_amount, tax_amount, total,
    payment_method, payments, card_details, status,
    cashier, cashier_role, notes, applied_discounts, free_gifts
  ) VALUES (
    gen_random_uuid(), p_shop_id, v_invoice, v_customer_id,
    p_sale_data->>'customerName',
    (p_sale_data->>'items')::JSONB,
    (p_sale_data->>'subtotal')::NUMERIC,
    COALESCE((p_sale_data->>'discountAmount')::NUMERIC, 0),
    COALESCE((p_sale_data->>'taxAmount')::NUMERIC, 0),
    v_total, p_sale_data->>'paymentMethod',
    p_payments, (p_sale_data->>'cardDetails')::JSONB,
    'completed', v_cashier_name, p_sale_data->>'cashierRole',
    p_sale_data->>'notes',
    COALESCE((p_sale_data->>'appliedDiscounts')::JSONB, '[]'::JSONB),
    COALESCE((p_sale_data->>'freeGifts')::JSONB, '[]'::JSONB)
  ) RETURNING id INTO v_sale_id;

  -- Inventory deduction (if tracking enabled)
  FOR v_item IN SELECT * FROM jsonb_array_elements((p_sale_data->>'items')::JSONB)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_qty := (v_item->>'quantity')::INT;
    IF v_product_id IS NOT NULL AND v_qty > 0 THEN
      UPDATE products
      SET stock = GREATEST(stock - v_qty, 0), updated_at = now()
      WHERE id = v_product_id AND track_inventory = true;
    END IF;
  END LOOP;

  -- Customer total purchases update
  IF v_customer_id IS NOT NULL THEN
    SELECT COALESCE(total_purchases, 0) INTO v_customer_total FROM customers WHERE id = v_customer_id;
    UPDATE customers
    SET total_purchases = v_customer_total + v_total,
        last_purchase = now(), updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'invoice_number', v_invoice);
END;
$$;

-- Re‑grant execute rights (no change to signature)
GRANT EXECUTE ON FUNCTION public.checkout_complete(UUID, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_invoice_number(UUID) TO authenticated;

-- End of migration
