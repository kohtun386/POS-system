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

  -- VISION.md §5.3: Subscription Tier is Gate 1 — ABSOLUTE.
  -- Per-shop overrides (shop_features) can enable/disable features
  -- WITHIN the shop's tier scope, but CANNOT grant features above
  -- the shop's tier level.
  --
  -- Resolution order:
  --   1. Tier gate: feature's min_tier must be <= shop's tier level
  --   2. Override (shop_features): if exists, use it (within tier scope)
  --   3. Default: fall back to default_enabled when no override
  RETURN QUERY
  WITH tier_gated AS (
    SELECT fd.key, fd.default_enabled
    FROM public.feature_definitions fd
    WHERE v_tier_level >= CASE fd.subscription_tier
      WHEN 'free' THEN 0
      WHEN 'growth' THEN 1
      WHEN 'pro' THEN 2
      ELSE 0
    END
  )
  SELECT tg.key AS capability
  FROM tier_gated tg
  WHERE
    -- Override exists and is enabled
    (tg.key IN (SELECT sf.feature_key FROM public.shop_features sf WHERE sf.shop_id = p_shop_id AND sf.enabled = true))
    OR
    -- No override: use default_enabled
    (tg.key NOT IN (SELECT sf.feature_key FROM public.shop_features sf WHERE sf.shop_id = p_shop_id)
     AND tg.default_enabled = true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_capabilities(UUID) TO authenticated;
