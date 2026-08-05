import { supabase } from '../supabase'
import { Shop } from '../../types'

export interface PlatformShop {
  id: string
  name: string
  address?: string
  email?: string
  phone?: string
  businessType?: string
  subscriptionTier: Shop['subscriptionTier']
  isActive: boolean
  dailyOrderLimit?: number
  ownerId?: string
  createdAt: string
  updatedAt?: string
  membershipActive?: boolean
  membershipRole?: string
}

export interface PlatformShopDetail {
  shop: Record<string, unknown>
  memberships: Record<string, unknown>[]
  users: Record<string, unknown>[]
  stats: { salesCount: number; totalRevenue: number }
}

export interface PlatformDailyStats {
  totalShops: number
  activeShops: number
  pendingApprovals: number
  mrr: number
}

export interface PlatformUserMembership {
  membershipId: string
  shopId: string
  shopName: string
  role: string
  isActive: boolean
  createdAt: string
}

export interface PlatformUser {
  userId: string
  username: string
  name: string
  email: string
  avatar: string | null
  isActive: boolean
  memberships: PlatformUserMembership[]
}

export const platformAdminService = {
  async approveShop(shopId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-approve-shop', {
      body: { shop_id: shopId },
    })
    if (error) throw error
  },

  async rejectShop(shopId: string, reason: string): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-reject-shop', {
      body: { shop_id: shopId, reason },
    })
    if (error) throw error
  },

  async updateSubscription(shopId: string, tier: 'free' | 'growth' | 'pro'): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-update-subscription', {
      body: { shop_id: shopId, tier },
    })
    if (error) throw error
  },

  async listShops(filters?: { status?: string; tier?: string }): Promise<PlatformShop[]> {
    const { data, error } = await supabase.functions.invoke('platform-admin-list-shops', {
      body: filters ?? {},
    })
    if (error) throw error
    return (data?.shops ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: s.name as string,
      address: s.address as string | undefined,
      email: s.email as string | undefined,
      phone: s.phone as string | undefined,
      subscriptionTier: s.subscription_tier as string,
      isActive: s.is_active as boolean,
      ownerId: s.owner_id as string | undefined,
      createdAt: s.created_at as string,
      updatedAt: s.updated_at as string | undefined,
      membershipActive: s.membership_active as boolean | undefined,
      membershipRole: s.membership_role as string | undefined,
    })) as PlatformShop[]
  },

  async getShopDetail(shopId: string): Promise<PlatformShopDetail> {
    const { data, error } = await supabase.functions.invoke('platform-admin-get-shop-detail', {
      body: { shop_id: shopId },
    })
    if (error) throw error
    return data as PlatformShopDetail
  },

  async manageFeatures(
    action: 'list' | 'create' | 'update' | 'delete',
    payload?: Record<string, unknown>,
  ): Promise<{ features?: Record<string, unknown>[]; feature?: Record<string, unknown>; message?: string }> {
    const { data, error } = await supabase.functions.invoke('platform-admin-manage-features', {
      body: { action, ...(payload ?? {}) },
    })
    if (error) throw error
    return data ?? {}
  },

  async dailyStats(): Promise<PlatformDailyStats> {
    const { data, error } = await supabase.functions.invoke('platform-admin-daily-stats')
    if (error) throw error
    return data?.stats as PlatformDailyStats
  },

  async toggleShopActive(shopId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-update-subscription', {
      body: { shop_id: shopId, is_active: isActive },
    })
    if (error) throw error
  },

  async deleteShop(shopId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-delete-shop', {
      body: { shop_id: shopId },
    })
    if (error) throw error
  },

  async listUsers(_filters?: {
    shop_id?: string
    role?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }): Promise<{ users: PlatformUser[]; total: number; page: number; pageSize: number }> {
    throw new Error("Platform Admin cannot manage staff per VISION.md §4.4. Deprecated.")
  },

  async updateUserRole(
    _membershipId: string,
    _userId: string,
    _shopId: string,
    _role: 'admin' | 'manager' | 'cashier',
  ): Promise<{ previousRole: string; newRole: string }> {
    throw new Error("Platform Admin cannot manage staff per VISION.md §4.4. Deprecated.")
  },

  async toggleUserActive(
    _membershipId: string,
    _userId: string,
    _shopId: string,
    _isActive: boolean,
  ): Promise<void> {
    throw new Error("Platform Admin cannot manage staff per VISION.md §4.4. Deprecated.")
  },
}
