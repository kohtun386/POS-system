import { supabase } from '../supabase'
import type { FeatureDefinition, ShopFeature, Shop } from '../../types'

export class DailyLimitError extends Error {
  constructor(message = 'Daily order limit reached. Upgrade to Growth.') {
    super(message)
    this.name = 'DailyLimitError'
  }
}

const TIER_HIERARCHY: Record<string, number> = { free: 0, growth: 1, pro: 2 }

/**
 * Resolve capabilities for a shop based on subscription tier + overrides.
 *
 * VISION.md §5.3 — Subscription Tier is Gate 1 (ABSOLUTE).
 * Per-shop overrides (shop_features) can ONLY REMOVE features.
 * They CANNOT grant features above the shop's tier level.
 *
 * Resolution order:
 *   1. Tier gate: feature's min_tier must be <= shop's tier level
 *   2. Default: feature must have default_enabled = true
 *   3. Override (shop_features): can only DISABLE, never enable beyond tier+default
 */
export function resolveCapabilities(
  shop: Shop,
  definitions: FeatureDefinition[],
  overrides: ShopFeature[]
): string[] {
  const shopTierLevel = TIER_HIERARCHY[shop.subscriptionTier] ?? 0

  const overrideMap = new Map<string, boolean>()
  for (const o of overrides) {
    overrideMap.set(o.featureKey, o.enabled)
  }

  const caps: string[] = []

  for (const def of definitions) {
    const defTierLevel = TIER_HIERARCHY[def.subscriptionTier] ?? 0
    if (shopTierLevel < defTierLevel) continue

    const override = overrideMap.get(def.key)
    if (override !== undefined) {
      if (override) caps.push(def.key)
    } else if (def.defaultEnabled) {
      caps.push(def.key)
    }
  }

  return caps
}

/**
 * Server-side capability resolution via RPC (VISION §5).
 * Returns flat string[] of capability keys for a shop.
 */
export async function resolveCapabilitiesRpc(shopId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('resolve_capabilities', {
    p_shop_id: shopId,
  })

  if (error) {
    console.error('Failed to resolve capabilities via RPC:', error)
    throw error
  }

  return (data ?? []).map((row: { capability: string }) => row.capability)
}
