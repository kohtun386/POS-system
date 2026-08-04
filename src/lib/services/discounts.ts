import { supabase } from '../supabase'
import type { Discount, DiscountCondition } from '../../types'
import type { Database } from '../database.types'

export const discountsService = {
  async getAll(shopId?: string): Promise<Discount[]> {
    let query = supabase
      .from('discounts')
      .select('*')
      .order('name')

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(discount => ({
      id: discount.id,
      shopId: discount.shop_id || undefined,
      name: discount.name,
      description: discount.description || '',
      type: discount.type as Discount['type'],
      value: discount.value || 0,
      conditions: Array.isArray(discount.conditions) ? discount.conditions as unknown as DiscountCondition[] : [],
      freeGiftProducts: discount.free_gift_products || undefined,
      minAmount: discount.min_amount || undefined,
      maxDiscount: discount.max_discount || undefined,
      validFrom: new Date(discount.valid_from),
      validTo: new Date(discount.valid_to),
      validDays: discount.valid_days || undefined,
      active: discount.active ?? true,
      createdAt: new Date(discount.created_at)
    }))
  },

  async create(discount: Omit<Discount, 'id' | 'createdAt'>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .insert({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions as unknown as Record<string, unknown>[],
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom.toISOString(),
        valid_to: discount.validTo.toISOString(),
        valid_days: discount.validDays,
        active: discount.active
      } as unknown as Database['public']['Tables']['discounts']['Insert'])
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id || undefined,
      name: data.name,
      description: data.description || '',
      type: data.type as Discount['type'],
      value: data.value || 0,
      conditions: Array.isArray(data.conditions) ? data.conditions as unknown as DiscountCondition[] : [],
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, discount: Partial<Discount>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .update({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions as unknown as Record<string, unknown>[],
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom?.toISOString(),
        valid_to: discount.validTo?.toISOString(),
        valid_days: discount.validDays,
        active: discount.active,
        updated_at: new Date().toISOString()
      } as unknown as Database['public']['Tables']['discounts']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id || undefined,
      name: data.name,
      description: data.description || '',
      type: data.type as Discount['type'],
      value: data.value || 0,
      conditions: Array.isArray(data.conditions) ? data.conditions as unknown as DiscountCondition[] : [],
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
