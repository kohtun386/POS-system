import { supabase } from '../supabase'
import type { PurchaseLog } from '../../types'

function mapPurchaseLogRow(row: Record<string, unknown>): PurchaseLog {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    supplier: (row.supplier as string) || '',
    item: row.item as string,
    quantity: Number(row.quantity),
    unit: (row.unit as string) || 'piece',
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    purchaseDate: new Date(row.purchase_date as string),
    notes: (row.notes as string) || '',
    createdBy: (row.created_by as string) || undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

export const purchaseLogsService = {
  async getAll(shopId: string, fromDate?: Date, toDate?: Date): Promise<PurchaseLog[]> {
    let q = supabase.from('purchase_logs').select('*').eq('shop_id', shopId).order('purchase_date', { ascending: false })
    if (fromDate) q = q.gte('purchase_date', fromDate.toISOString().split('T')[0])
    if (toDate) q = q.lte('purchase_date', toDate.toISOString().split('T')[0])
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(mapPurchaseLogRow)
  },

  async create(input: Omit<PurchaseLog, 'id' | 'createdAt' | 'updatedAt' | 'totalCost'>): Promise<PurchaseLog> {
    const { data, error } = await supabase
      .from('purchase_logs')
      .insert({
        shop_id: input.shopId,
        supplier: input.supplier,
        item: input.item,
        quantity: input.quantity,
        unit: input.unit,
        unit_cost: input.unitCost,
        purchase_date: input.purchaseDate.toISOString().split('T')[0],
        notes: input.notes,
        created_by: input.createdBy,
      })
      .select()
      .single()
    if (error) throw error
    return mapPurchaseLogRow(data)
  },

  async update(id: string, input: Partial<PurchaseLog>): Promise<PurchaseLog> {
    const updates: Record<string, unknown> = {}
    if (input.supplier !== undefined) updates.supplier = input.supplier
    if (input.item !== undefined) updates.item = input.item
    if (input.quantity !== undefined) updates.quantity = input.quantity
    if (input.unit !== undefined) updates.unit = input.unit
    if (input.unitCost !== undefined) updates.unit_cost = input.unitCost
    if (input.purchaseDate !== undefined) updates.purchase_date = input.purchaseDate.toISOString().split('T')[0]
    if (input.notes !== undefined) updates.notes = input.notes
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('purchase_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return mapPurchaseLogRow(data)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('purchase_logs').delete().eq('id', id)
    if (error) throw error
  },

  async getMonthlyTotal(shopId: string, year: number, month: number): Promise<number> {
    const from = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const to = new Date(year, month, 0).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('purchase_logs')
      .select('total_cost')
      .eq('shop_id', shopId)
      .gte('purchase_date', from)
      .lte('purchase_date', to)
    if (error) throw error
    return (data || []).reduce((sum, r) => sum + Number(r.total_cost), 0)
  },
}
