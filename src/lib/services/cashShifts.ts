import { supabase } from '../supabase'
import type { CashShift } from '../../types'

export const cashShiftsService = {
  async getOpenByCashier(cashierId: string): Promise<CashShift | null> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      closingCash: data.closing_cash != null ? Number(data.closing_cash) : undefined,
      expectedCash: data.expected_cash != null ? Number(data.expected_cash) : undefined,
      variance: data.variance != null ? Number(data.variance) : undefined,
      status: data.status as 'open' | 'closed',
      openedAt: new Date(data.opened_at),
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    }
  },

  async create(input: { shopId: string; cashierId: string; openingCash: number }): Promise<CashShift> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .insert({
        shop_id: input.shopId,
        cashier_id: input.cashierId,
        opening_cash: input.openingCash,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      status: 'open',
      openedAt: new Date(data.opened_at),
    }
  },

  async close(id: string, closingCash: number, expectedCash?: number): Promise<CashShift> {
    const variance = expectedCash != null ? closingCash - expectedCash : undefined

    const { data, error } = await supabase
      .from('cash_shifts')
      .update({
        closing_cash: closingCash,
        expected_cash: expectedCash,
        variance,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      expectedCash: data.expected_cash != null ? Number(data.expected_cash) : undefined,
      variance: data.variance != null ? Number(data.variance) : undefined,
      status: 'closed',
      openedAt: new Date(data.opened_at),
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    }
  },

  async getByShopId(shopId: string, limit = 10): Promise<CashShift[]> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('shop_id', shopId)
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      cashierId: row.cashier_id as string,
      openingCash: Number(row.opening_cash),
      closingCash: row.closing_cash != null ? Number(row.closing_cash) : undefined,
      expectedCash: row.expected_cash != null ? Number(row.expected_cash) : undefined,
      variance: row.variance != null ? Number(row.variance) : undefined,
      status: row.status as 'open' | 'closed',
      openedAt: new Date(row.opened_at as string),
      closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
    }))
  },
}
