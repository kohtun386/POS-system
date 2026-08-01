-- ================================================================
-- Migration: Simplify resolve_capabilities() — Tier-Only Resolution
-- Date: August 3, 2026
-- Description:
--   Replaces resolve_capabilities() with tier-only logic.
--   Removes shop_features override mechanism entirely.
--
--   Old logic: tier gate → shop_features override → default_enabled
--   New logic: tier gate + default_enabled only
--
--   has_capability() calls resolve_capabilities() — no change needed.
--   RLS policies call has_capability() — no change needed.
--
--   shop_features table NOT dropped yet (Phase 3 safety hold).
--   Will be dropped after frontend cleanup is complete.
-- ================================================================

-- ================================================================
-- 1. REPLACE resolve_capabilities() — Tier-Only Logic
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

  -- Tier-only resolution: subscription tier + default_enabled
  -- No per-shop overrides. Feature availability is strictly
  -- determined by tier. (VISION §5.3, tier-spec.md §3.3)
  RETURN QUERY
  SELECT fd.key AS capability
  FROM public.feature_definitions fd
  WHERE v_tier_level >= CASE fd.subscription_tier
    WHEN 'free' THEN 0
    WHEN 'growth' THEN 1
    WHEN 'pro' THEN 2
    ELSE 0
  END
  AND fd.default_enabled = true;
END;
$$;

-- Grant execute to authenticated users (same as before)
GRANT EXECUTE ON FUNCTION public.resolve_capabilities(UUID) TO authenticated;

-- ================================================================
-- VERIFICATION (run manually after migration):
--
-- 1. Confirm function exists:
--    SELECT routine_name FROM information_schema.routines
--    WHERE routine_name = 'resolve_capabilities';
--
-- 2. Test with a real shop UUID:
--    SELECT * FROM resolve_capabilities('<shop-uuid>');
--
-- 3. Confirm has_capability still works:
--    SELECT has_capability('<shop-uuid>', 'pos');
-- ================================================================
