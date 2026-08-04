import { supabase } from '../supabase'
import type { SalesTab, CartItem } from '../../types'
import type { Database } from '../database.types'

export const salesTabsService = {
  async getByUserId(userId: string): Promise<SalesTab[]> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .select(`
        *,
        selected_customer:customers(*)
      `)
      .eq('user_id', userId)
      .order('created_at')

    if (error) throw error

    return data.map(tab => ({
      id: tab.id,
      name: tab.name,
      cart: (tab.cart as unknown as CartItem[]) || [],
      selectedCustomer: tab.selected_customer ? {
        id: tab.selected_customer.id,
        name: tab.selected_customer.name,
        email: tab.selected_customer.email || '',
        phone: tab.selected_customer.phone || '',
        address: tab.selected_customer.address || '',
        creditLimit: tab.selected_customer.credit_limit || 0,
        creditUsed: tab.selected_customer.credit_used || 0,
        priceTier: tab.selected_customer.price_tier || 'Standard',
        totalPurchases: tab.selected_customer.total_purchases || 0,
        lastPurchase: tab.selected_customer.last_purchase ? new Date(tab.selected_customer.last_purchase) : undefined,
        createdAt: new Date(tab.selected_customer.created_at)
      } : null,
      createdAt: new Date(tab.created_at)
    }))
  },

  async create(userId: string, tab: Omit<SalesTab, 'id' | 'createdAt'>, shopId?: string): Promise<SalesTab> {
    const insertData: Record<string, unknown> = {
      user_id: userId,
      name: tab.name,
      cart: tab.cart,
      selected_customer_id: tab.selectedCustomer?.id,
    }
    if (shopId) {
      insertData.shop_id = shopId
    }
    const { data, error } = await supabase
      .from('sales_tabs')
      .insert(insertData as unknown as Database['public']['Tables']['sales_tabs']['Insert'])
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: (data.cart as unknown as CartItem[]) || [],
      selectedCustomer: tab.selectedCustomer,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, tab: Partial<SalesTab>): Promise<SalesTab> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .update({
        name: tab.name,
        cart: tab.cart as unknown as Record<string, unknown>[],
        selected_customer_id: tab.selectedCustomer?.id
      } as unknown as Database['public']['Tables']['sales_tabs']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: (data.cart as unknown as CartItem[]) || [],
      selectedCustomer: tab.selectedCustomer || null,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales_tabs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
