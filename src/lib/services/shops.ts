import { supabase } from '../supabase'
import type { Shop, FeatureDefinition, ShopFeature, CapabilityResolution } from '../../types'
import { resolveCapabilitiesRpc } from './common'

function mapShopRow(row: Record<string, unknown>): Shop {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    address: (row.address as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    logo: (row.logo as string) || undefined,
    ownerId: (row.owner_id as string) || undefined,
    businessType: (row.business_type as string) || 'coffee_shop',
    taxRate: Number(row.tax_rate ?? 0),
    invoicePrefix: (row.invoice_prefix as string) || 'INV',
    invoiceCounter: (row.invoice_counter as number) ?? 0,
    draftRetentionDays: (row.draft_retention_days as number) ?? 30,
    subscriptionTier: (row.subscription_tier as string) || 'free',
    dailyOrderLimit: (row.daily_order_limit as number) ?? undefined,
    receiptSetting: (row.receipt_setting as string) || 'ask',
    isActive: (row.is_active as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export const shopMembershipsService = {
  async getShopByUserId(userId: string): Promise<Shop | null> {
    const { data, error } = await supabase
      .from('shop_memberships')
      .select('shop:shops(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    const shop = (data as { shop: Record<string, unknown> }).shop
    if (!shop) return null

    return mapShopRow(shop)
  },
}

export const shopsService = {
  async getById(id: string): Promise<Shop> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return mapShopRow(data)
  },

  async getByUserId(userId: string): Promise<Shop | null> {
    return shopMembershipsService.getShopByUserId(userId)
  },

  async getShopWithCapabilities(userId: string): Promise<CapabilityResolution | null> {
    const shop = await shopMembershipsService.getShopByUserId(userId)
    if (!shop) return null

    const [features, overrides, capabilities] = await Promise.all([
      featureDefinitionsService.getAll(),
      shopFeaturesService.getByShopId(shop.id),
      resolveCapabilitiesRpc(shop.id),
    ])

    return { capabilities, shop, features, overrides }
  },
}

export const featureDefinitionsService = {
  async getAll(): Promise<FeatureDefinition[]> {
    const { data, error } = await supabase
      .from('feature_definitions')
      .select('*')
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      key: row.key as string,
      name: row.name as string,
      description: row.description as string,
      category: row.category as string,
      defaultEnabled: row.default_enabled as boolean,
      subscriptionTier: row.subscription_tier as string,
      createdAt: new Date(row.created_at as string),
    }))
  },
}

export const shopFeaturesService = {
  async getByShopId(shopId: string): Promise<ShopFeature[]> {
    const { data, error } = await supabase
      .from('shop_features')
      .select('*')
      .eq('shop_id', shopId)
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      featureKey: row.feature_key as string,
      enabled: row.enabled as boolean,
      updatedAt: new Date(row.updated_at as string),
    }))
  },

  async setFeature(shopId: string, featureKey: string, enabled: boolean): Promise<ShopFeature> {
    const { data, error } = await supabase
      .from('shop_features')
      .upsert(
        { shop_id: shopId, feature_key: featureKey, enabled },
        { onConflict: 'shop_id,feature_key' }
      )
      .select()
      .single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      featureKey: data.feature_key,
      enabled: data.enabled,
      updatedAt: new Date(data.updated_at),
    }
  },

  async deleteFeature(shopId: string, featureKey: string): Promise<void> {
    const { error } = await supabase
      .from('shop_features')
      .delete()
      .eq('shop_id', shopId)
      .eq('feature_key', featureKey)
    if (error) throw error
  },
}
