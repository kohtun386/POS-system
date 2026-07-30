import { supabase } from '../supabase'
import type { Customer } from '../../types'

export const customersService = {
  async getAll(shopId?: string): Promise<Customer[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .order('name')

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      creditLimit: customer.credit_limit || 0,
      creditUsed: customer.credit_used || 0,
      priceTier: customer.price_tier || 'Standard',
      totalPurchases: customer.total_purchases || 0,
      lastPurchase: customer.last_purchase ? new Date(customer.last_purchase) : undefined,
      createdAt: new Date(customer.created_at)
    }))
  },

  async create(customer: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        credit_limit: customer.creditLimit,
        credit_used: customer.creditUsed,
        price_tier: customer.priceTier,
        total_purchases: customer.totalPurchases,
        last_purchase: customer.lastPurchase?.toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, customer: Partial<Customer>): Promise<Customer> {
    const updateData: Record<string, unknown> = {}

    if (customer.name !== undefined) updateData.name = customer.name
    if (customer.email !== undefined) updateData.email = customer.email
    if (customer.phone !== undefined) updateData.phone = customer.phone
    if (customer.address !== undefined) updateData.address = customer.address
    if (customer.creditLimit !== undefined) updateData.credit_limit = customer.creditLimit
    if (customer.creditUsed !== undefined) updateData.credit_used = customer.creditUsed
    if (customer.priceTier !== undefined) updateData.price_tier = customer.priceTier
    if (customer.totalPurchases !== undefined) updateData.total_purchases = customer.totalPurchases
    if (customer.lastPurchase !== undefined) updateData.last_purchase = customer.lastPurchase?.toISOString()

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
