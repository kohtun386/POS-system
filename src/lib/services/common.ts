import { supabase } from '../supabase'
import type { FeatureDefinition, Shop } from '../../types'

export class DailyLimitError extends Error {
  constructor(message = 'Daily order limit reached. Upgrade to Growth.') {
    super(message)
    this.name = 'DailyLimitError'
  }
}

export class ProductLimitError extends Error {
  constructor(message = 'Product limit reached. Upgrade to Growth.') {
    super(message)
    this.name = 'ProductLimitError'
  }
}

const TIER_HIERARCHY: Record<string, number> = { free: 0, growth: 1, pro: 2 }

/**
 * Resolve capabilities for a shop based on subscription tier only.
 *
 * VISION.md §5.3 — Subscription Tier is the sole authority.
 * No per-shop overrides. Feature availability is strictly
 * determined by tier + default_enabled.
 *
 * Resolution:
 *   1. Tier gate: feature's subscription_tier must be <= shop's tier level
 *   2. Feature must have default_enabled = true
 */
export function resolveCapabilities(
  shop: Shop,
  definitions: FeatureDefinition[],
): string[] {
  const shopTierLevel = TIER_HIERARCHY[shop.subscriptionTier] ?? 0
  const caps: string[] = []

  for (const def of definitions) {
    const defTierLevel = TIER_HIERARCHY[def.subscriptionTier] ?? 0
    if (shopTierLevel < defTierLevel) continue
    if (def.defaultEnabled) {
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
