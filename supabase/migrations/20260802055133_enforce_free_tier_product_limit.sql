-- ================================================================
-- Migration: Enforce Free-tier 50-product limit + resolve shop_id
-- Date: 2026-08-03
-- Description:
--   Server-side guard for VISION.md §3.3 / §16.3:
--   "Max 50 products — enforced at product creation with
--    client-side validation and server-side guard."
--
--   The app's productsService.create() does NOT send shop_id
--   (products.shop_id is NOT NULL with no default), so every app
--   insert fails with 23502. This trigger fixes BOTH:
--
--   1. RESOLVE shop_id when omitted — from the authenticated user's
--      active shop membership (matches how the frontend resolves its
--      active shop via shopMembershipsService.getShopByUserId()).
--      A BEFORE INSERT trigger runs BEFORE the RLS WITH CHECK, so the
--      assigned NEW.shop_id satisfies the insert policy. (Verified.)
--
--   2. ENFORCE the 50-product cap — Free-tier shops raise
--      'Unable to create product' at count >= 50. Growth/Pro
--      are unlimited. All products (active and inactive) count
--      toward the quota to prevent bypass via deactivation.
--      Message is uniform to prevent tenant state disclosure
--      (no shop existence or tier leak). Shop row lock
--      (FOR NO KEY UPDATE) serializes concurrent inserts
--      (VISION §16.2 race-condition pattern, same idiom as
--      reserve_invoice_number's FOR UPDATE lock).
--
-- Safety: SECURITY DEFINER, SET search_path = '', REVOKE from anon.
-- No current_shop_ids() call here (avoids RLS recursion on memberships).
-- ================================================================

CREATE OR REPLACE FUNCTION public.enforce_free_tier_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shop_id UUID;
  v_tier TEXT;
  v_count INT;
BEGIN
  -- 1. Resolve shop_id when the client omitted it (app's normal path).
  --    A BEFORE INSERT trigger fires before RLS WITH CHECK, so the value
  --    assigned here satisfies the "shop_id IN current_shop_ids()" policy.
  IF NEW.shop_id IS NULL THEN
    SELECT shop_id INTO NEW.shop_id
    FROM public.shop_memberships
    WHERE user_id = auth.uid()
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF NEW.shop_id IS NULL THEN
      RAISE EXCEPTION 'No active shop membership for current user';
    END IF;
  END IF;

  v_shop_id := NEW.shop_id;

  -- 2. Look up subscription tier.
  SELECT subscription_tier INTO v_tier
  FROM public.shops
  WHERE id = v_shop_id;

  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'Unable to create product';
  END IF;

  -- Only Free tier is capped (VISION §16.3).
  IF v_tier <> 'free' THEN
    RETURN NEW;
  END IF;

  -- 3. Serialize concurrent inserts on the same shop (VISION §16.2 pattern).
  --    Lighter than FOR UPDATE — the shops row is only a lock target here.
  PERFORM 1 FROM public.shops WHERE id = v_shop_id FOR NO KEY UPDATE;

  -- 4. Enforce the cap.
  SELECT COUNT(*) INTO v_count
  FROM public.products
  WHERE shop_id = v_shop_id;

  IF v_count >= 50 THEN
    RAISE EXCEPTION 'Unable to create product';
  END IF;

  RETURN NEW;
END;
$$;

-- SECURITY DEFINER functions must not be executable by anon/authenticated
-- directly (VISION §4.3 — they run under the trigger, not via RPC).
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_free_tier_product_limit() TO service_role;

-- BEFORE INSERT — fires before RLS WITH CHECK evaluates the row.
CREATE TRIGGER trg_enforce_free_tier_product_limit
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_tier_product_limit();
