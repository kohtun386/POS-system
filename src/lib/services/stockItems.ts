import { supabase } from '../supabase'
import type { StockItem, StockAdjustment } from '../../types'

function mapStockItemRow(row: Record<string, unknown>): StockItem {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    name: row.name as string,
    quantity: Number(row.quantity),
    unit: (row.unit as string) || 'piece',
    lowThreshold: Number(row.low_threshold ?? 0),
    category: (row.category as string) || '',
    notes: (row.notes as string) || '',
    lastAdjustedAt: row.last_adjusted_at ? new Date(row.last_adjusted_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

function mapStockAdjustmentRow(row: Record<string, unknown>, shopId: string): StockAdjustment {
  return {
    id: row.id as string,
    shopId,
    stockItemId: row.stock_item_id as string,
    previousQty: Number(row.previous_qty),
    newQty: Number(row.new_qty),
    reason: (row.reason as string) || '',
    adjustedBy: (row.adjusted_by as string) || undefined,
    adjustedAt: new Date(row.adjusted_at as string),
  }
}

export const stockItemsService = {
  async getAll(shopId: string): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    if (error) throw error
    return (data || []).map(mapStockItemRow)
  },

  async getById(id: string): Promise<StockItem | null> {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? mapStockItemRow(data) : null
  },

  async create(input: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt' | 'lastAdjustedAt'>): Promise<StockItem> {
    const { data, error } = await supabase
      .from('stock_items')
      .insert({
        shop_id: input.shopId,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        low_threshold: input.lowThreshold,
        category: input.category,
        notes: input.notes,
      })
      .select()
      .single()
    if (error) throw error
    return mapStockItemRow(data)
  },

  async update(id: string, input: Partial<StockItem>): Promise<StockItem> {
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.quantity !== undefined) updates.quantity = input.quantity
    if (input.unit !== undefined) updates.unit = input.unit
    if (input.lowThreshold !== undefined) updates.low_threshold = input.lowThreshold
    if (input.category !== undefined) updates.category = input.category
    if (input.notes !== undefined) updates.notes = input.notes
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('stock_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return mapStockItemRow(data)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('stock_items').delete().eq('id', id)
    if (error) throw error
  },

  async adjust(
    id: string,
    newQty: number,
    reason: string,
    adjustedBy?: string
  ): Promise<{ item: StockItem; adjustment: StockAdjustment }> {
    const item = await this.getById(id)
    if (!item) throw new Error('Stock item not found')

    const previousQty = item.quantity
    const now = new Date().toISOString()

    const { data: adjData, error: adjError } = await supabase
      .from('stock_adjustments')
      .insert({
        shop_id: item.shopId,
        stock_item_id: id,
        previous_qty: previousQty,
        new_qty: newQty,
        reason,
        adjusted_by: adjustedBy,
        adjusted_at: now,
      })
      .select()
      .single()
    if (adjError) throw adjError

    const { data: itemData, error: itemError } = await supabase
      .from('stock_items')
      .update({ quantity: newQty, last_adjusted_at: now, updated_at: now })
      .eq('id', id)
      .select()
      .single()
    if (itemError) throw itemError

    return {
      item: mapStockItemRow(itemData),
      adjustment: mapStockAdjustmentRow(adjData, item.shopId),
    }
  },

  async getAdjustments(stockItemId: string): Promise<StockAdjustment[]> {
    const { data, error } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('stock_item_id', stockItemId)
      .order('adjusted_at', { ascending: false })
    if (error) throw error
    return (data || []).map(row => mapStockAdjustmentRow(row, row.shop_id))
  },

  async getLowStock(shopId: string): Promise<StockItem[]> {
    const items = await this.getAll(shopId)
    return items.filter(i => i.quantity <= i.lowThreshold)
  },
}
