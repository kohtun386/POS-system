import { describe, it, expect } from 'vitest'
import { resolveCapabilities } from '../../services'
import type { Shop, FeatureDefinition, ShopFeature } from '../../../types'

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-1',
    name: 'Test Shop',
    address: '',
    phone: '',
    email: '',
    businessType: 'coffee_shop',
    taxRate: 0,
    currency: 'MMK',
    baseCurrency: 'MMK',
    invoicePrefix: 'INV',
    invoiceCounter: 0,
    draftRetentionDays: 30,
    subscriptionTier: 'free',
    receiptSetting: 'ask',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeDef(overrides: Partial<FeatureDefinition> = {}): FeatureDefinition {
  return {
    id: 'def-1',
    key: 'pos',
    name: 'POS',
    category: 'core',
    defaultEnabled: true,
    subscriptionTier: 'free',
    createdAt: new Date(),
    ...overrides,
  }
}

function makeOverride(key: string, enabled: boolean, shopId = 'shop-1'): ShopFeature {
  return {
    id: 'ov-1',
    shopId,
    featureKey: key,
    enabled,
    updatedAt: new Date(),
  }
}

describe('resolveCapabilities', () => {
  it('returns default-enabled free-tier features for a free shop', () => {
    const shop = makeShop({ subscriptionTier: 'free' })
    const defs = [
      makeDef({ key: 'pos', subscriptionTier: 'free', defaultEnabled: true }),
      makeDef({ key: 'inventory', subscriptionTier: 'free', defaultEnabled: true }),
      makeDef({ key: 'receipt_printing', subscriptionTier: 'growth', defaultEnabled: true }),
    ]

    const caps = resolveCapabilities(shop, defs, [])

    expect(caps).toContain('pos')
    expect(caps).toContain('inventory')
    expect(caps).not.toContain('receipt_printing')
  })

  it('includes growth-tier features for growth shop', () => {
    const shop = makeShop({ subscriptionTier: 'growth' })
    const defs = [
      makeDef({ key: 'pos', subscriptionTier: 'free', defaultEnabled: true }),
      makeDef({ key: 'receipt_printing', subscriptionTier: 'growth', defaultEnabled: true }),
      makeDef({ key: 'owner_insights', subscriptionTier: 'pro', defaultEnabled: true }),
    ]

    const caps = resolveCapabilities(shop, defs, [])

    expect(caps).toContain('pos')
    expect(caps).toContain('receipt_printing')
    expect(caps).not.toContain('owner_insights')
  })

  it('includes all tier features for pro shop', () => {
    const shop = makeShop({ subscriptionTier: 'pro' })
    const defs = [
      makeDef({ key: 'pos', subscriptionTier: 'free', defaultEnabled: true }),
      makeDef({ key: 'receipt_printing', subscriptionTier: 'growth', defaultEnabled: true }),
      makeDef({ key: 'owner_insights', subscriptionTier: 'pro', defaultEnabled: true }),
    ]

    const caps = resolveCapabilities(shop, defs, [])

    expect(caps).toContain('pos')
    expect(caps).toContain('receipt_printing')
    expect(caps).toContain('owner_insights')
  })

  it('excludes features with defaultEnabled=false', () => {
    const shop = makeShop({ subscriptionTier: 'free' })
    const defs = [
      makeDef({ key: 'pos', defaultEnabled: true }),
      makeDef({ key: 'optional_feature', defaultEnabled: false }),
    ]

    const caps = resolveCapabilities(shop, defs, [])

    expect(caps).toContain('pos')
    expect(caps).not.toContain('optional_feature')
  })

  it('override enables feature even if defaultEnabled=false', () => {
    const shop = makeShop({ subscriptionTier: 'free' })
    const defs = [
      makeDef({ key: 'optional_feature', defaultEnabled: false, subscriptionTier: 'free' }),
    ]
    const overrides = [makeOverride('optional_feature', true)]

    const caps = resolveCapabilities(shop, defs, overrides)

    expect(caps).toContain('optional_feature')
  })

  it('override disables feature even if defaultEnabled=true', () => {
    const shop = makeShop({ subscriptionTier: 'free' })
    const defs = [
      makeDef({ key: 'pos', defaultEnabled: true, subscriptionTier: 'free' }),
    ]
    const overrides = [makeOverride('pos', false)]

    const caps = resolveCapabilities(shop, defs, overrides)

    expect(caps).not.toContain('pos')
  })

  it('override CANNOT enable feature above shop tier (VISION.md §5.3 — absolute tier gate)', () => {
    const shop = makeShop({ subscriptionTier: 'free' })
    const defs = [
      makeDef({ key: 'owner_insights', subscriptionTier: 'pro', defaultEnabled: false }),
    ]
    const overrides = [makeOverride('owner_insights', true)]

    const caps = resolveCapabilities(shop, defs, overrides)

    // VISION.md §5.3: Subscription Tier is Gate 1 — ABSOLUTE.
    // Overrides CANNOT grant features above the shop's tier level.
    expect(caps).not.toContain('owner_insights')
  })

  it('returns empty array when no definitions exist', () => {
    const shop = makeShop()
    const caps = resolveCapabilities(shop, [], [])
    expect(caps).toEqual([])
  })
})
