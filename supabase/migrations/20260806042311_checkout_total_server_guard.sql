-- ================================================================
-- Server-side total guard for checkout_complete (Part 2)
-- Baseline: pg_get_functiondef captured 2026-08-06
-- Change: Recompute total server-side from subtotal/discount/tax,
--         floored at 0. Client-supplied total no longer determines
--         the stored total.
-- ================================================================

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
  v_subtotal NUMERIC;
  v_discount_amount NUMERIC;
  v_tax_amount NUMERIC;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_customer_total NUMERIC;
  v_daily_limit INT;
  v_daily_count INT;
  v_cashier_name TEXT;
BEGIN
  -- FIX: FOR UPDATE on shops row (race condition protection)
  SELECT daily_order_limit INTO v_daily_limit
  FROM shops WHERE id = p_shop_id FOR UPDATE;

  -- FIX: Count by shop_id (not cashier), filter by status='completed'
  IF v_daily_limit IS NOT NULL AND v_daily_limit > 0 THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM sales
    WHERE shop_id = p_shop_id
      AND status = 'completed'
      AND created_at >= CURRENT_DATE;

    IF v_daily_count >= v_daily_limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
    END IF;
  END IF;

  -- Reserve the invoice number **before** any other work
  v_invoice := reserve_invoice_number(p_shop_id);

  v_customer_id := (p_sale_data->>'customerId')::UUID;

  -- FIX: Extract subtotal/discount/tax for server-side total recomputation.
  -- The client-supplied 'total' is intentionally ignored — we recompute it
  -- here so the stored total cannot be tampered or produce a negative value.
  v_subtotal := (p_sale_data->>'subtotal')::NUMERIC;
  v_discount_amount := COALESCE((p_sale_data->>'discountAmount')::NUMERIC, 0);
  v_tax_amount := COALESCE((p_sale_data->>'taxAmount')::NUMERIC, 0);

  -- Clamp discount at [0, subtotal] and floor total at 0.
  v_discount_amount := LEAST(GREATEST(v_discount_amount, 0), v_subtotal);
  v_total := GREATEST(v_subtotal - v_discount_amount + v_tax_amount, 0);

  -- Resolve cashier. Guard the FK: if p_cashier_id is not a real user, keep the
  -- graceful 'Unknown' fallback and store NULL cashier_id (never let checkout fail).
  SELECT name INTO v_cashier_name FROM users WHERE id = p_cashier_id;
  IF v_cashier_name IS NULL THEN
    v_cashier_name := 'Unknown';
    p_cashier_id := NULL;
  END IF;

  INSERT INTO sales (
    id, shop_id, invoice_number, customer_id, customer_name,
    items, subtotal, discount_amount, tax_amount, total,
    payment_method, payments, card_details, status,
    cashier, cashier_id, cashier_role, notes, applied_discounts, free_gifts
  ) VALUES (
    gen_random_uuid(), p_shop_id, v_invoice, v_customer_id,
    p_sale_data->>'customerName',
    (p_sale_data->>'items')::JSONB,
    v_subtotal,
    v_discount_amount,
    v_tax_amount,
    v_total, p_sale_data->>'paymentMethod',
    p_payments, (p_sale_data->>'cardDetails')::JSONB,
    'completed', v_cashier_name, p_cashier_id, p_sale_data->>'cashierRole',
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
        last_purchase = now(),
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'invoice_number', v_invoice);
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_complete(UUID, JSONB, JSONB, UUID) TO authenticated;
