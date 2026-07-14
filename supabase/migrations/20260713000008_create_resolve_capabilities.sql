-- ================================================================
-- resolve_capabilities RPC
-- VISION.md §5.2 — Server-side capability resolution
-- Matches JS logic in src/lib/services.ts:95
-- ================================================================

CREATE OR REPLACE FUNCTION public.resolve_capabilities(p_shop_id UUID)
RETURNS TABLE(capability TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tier_level INT;
  v_tier TEXT;
BEGIN
  -- 1. Get shop's subscription tier and map to numeric level
  --    TIER_HIERARCHY: free=0, growth=1, pro=2
  SELECT subscription_tier INTO v_tier
  FROM public.shops
  WHERE id = p_shop_id;

  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'Shop not found: %', p_shop_id;
  END IF;

  v_tier_level := CASE v_tier
    WHEN 'free' THEN 0
    WHEN 'growth' THEN 1
    WHEN 'pro' THEN 2
    ELSE 0
  END;

  -- 2. Resolve capabilities: override wins, else tier gate + default_enabled
  RETURN QUERY
  SELECT fd.key AS capability
  FROM public.feature_definitions fd
  LEFT JOIN public.shop_features sf
    ON sf.feature_key = fd.key
    AND sf.shop_id = p_shop_id
  WHERE
    -- If override exists: include only if enabled=true
    (sf.enabled = true)
    OR
    -- If no override: include if tier gate passes AND default_enabled
    (sf.id IS NULL AND v_tier_level >= CASE fd.subscription_tier
      WHEN 'free' THEN 0
      WHEN 'growth' THEN 1
      WHEN 'pro' THEN 2
      ELSE 0
    END AND fd.default_enabled = true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_capabilities(UUID) TO authenticated;
