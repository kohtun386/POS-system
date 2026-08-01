-- ================================================================
-- MIRROR of remote-only migration `20260801094135` (B1)
-- Date: 2026-08-01
--
-- PROVENANCE: The B1 fix reached LIVE under version timestamp
-- `20260801094135` (applied by opencode directly), but that version
-- has no local file. This file mirrors the remote record's executable
-- SQL byte-for-byte so `supabase migration list` matches and a future
-- `supabase db push` does not fail with LegacyDbPushMissingLocalError.
-- Superseded in local history by `20260801180000` (same content,
-- canonical local version). Re-running either is idempotent.
-- ================================================================
-- Migration: Fix daily_order_limit provisioning & enforcement (B1)
-- Date: 2026-08-01
-- Description:
--   Three bugs fixed in one migration:
--   1. Schema: daily_order_limit DEFAULT was NULL, should be 50
--   2. approve_shop(): didn't set daily_order_limit on activation
--   3. checkout_complete(): counted per-cashier-name (should be per-shop),
--      lacked FOR UPDATE locking, and didn't filter by status='completed'
-- ================================================================

-- ================================================================
-- 1. FIX SCHEMA DEFAULT
--    New shops created via handle_new_auth_user() will get 50
-- ================================================================
ALTER TABLE shops ALTER COLUMN daily_order_limit SET DEFAULT 50;

-- ================================================================
-- 2. BACKFILL EXISTING FREE SHOPS
--    All current free shops with NULL limit get 50
-- ================================================================
UPDATE shops
SET daily_order_limit = 50
WHERE subscription_tier = 'free' AND daily_order_limit IS NULL;

-- ================================================================
-- 3. FIX approve_shop() RPC
--    Set daily_order_limit = 50 when activating a shop
-- ================================================================
CREATE OR REPLACE FUNCTION public.approve_shop(
    p_shop_id UUID,
    p_approver_id UUID
)
RETURNS JSONB
SET search_path = ''
AS $$
DECLARE
    v_shop RECORD;
    v_membership RECORD;
BEGIN
    -- 1. Validate shop exists and is not already active
    SELECT id, name, is_active INTO v_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND');
    END IF;

    IF v_shop.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHOP_ALREADY_ACTIVE');
    END IF;

    -- 2. Validate approver is platform_admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_approver_id AND role = 'platform_admin'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    -- 3. Get the admin membership (owner) for this shop
    SELECT id, user_id INTO v_membership
    FROM public.shop_memberships
    WHERE shop_id = p_shop_id AND role = 'admin'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ADMIN_MEMBERSHIP');
    END IF;

    -- 4. Atomic updates
    -- 4a. Activate the shop (FIX: added daily_order_limit = 50)
    UPDATE public.shops
    SET is_active = true,
        subscription_tier = 'free',
        daily_order_limit = 50,
        updated_at = now()
    WHERE id = p_shop_id;

    -- 4b. Activate the admin's membership
    UPDATE public.shop_memberships
    SET is_active = true, updated_at = now()
    WHERE id = v_membership.id;

    -- 4c. Activate the owner's user profile
    UPDATE public.users
    SET active = true, updated_at = now()
    WHERE id = v_membership.user_id;

    -- 5. Audit log
    INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, shop_id, details)
    VALUES (
        p_approver_id,
        'approve_shop',
        'shop',
        p_shop_id,
        p_shop_id,
        jsonb_build_object(
            'shop_name', v_shop.name,
            'owner_id', v_membership.user_id
        )
    );

    -- 6. Return success
    RETURN jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'shop_name', v_shop.name,
        'owner_id', v_membership.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 4. FIX checkout_complete() RPC
--    - FOR UPDATE on shops row (race condition protection)
--    - Count by shop_id (not cashier name)
--    - Filter by status='completed' (ignore drafts/abandoned)
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
