-- ================================================================
-- FIX: Count all products (active + inactive) toward quota
-- Generated: 2026-08-03
-- Description:
--   The original enforce_free_tier_product_limit trigger counted
--   only active products. This allowed Free-tier shops to bypass
--   the 50-product cap by deactivating products before creating
--   new ones. This migration fixes the trigger to count ALL
--   products regardless of active status.
--
--   Also applies prior fixes from this branch:
--   - ORDER BY created_at ASC for deterministic shop selection
--   - Uniform error messages to prevent tenant state disclosure
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
  PERFORM 1 FROM public.shops WHERE id = v_shop_id FOR NO KEY UPDATE;

  -- 4. Enforce the cap — count ALL products (active + inactive).
  --    Prevents bypass via deactivation.
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
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_free_tier_product_limit() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_free_tier_product_limit() TO service_role;
