import { supabase } from '../supabase'
import type { Sale, CartItem, Payment, CardDetails, AppliedDiscount } from '../../types'
import { DailyLimitError } from './common'

export const checkoutService = {
  async complete(
    shopId: string,
    saleData: Record<string, unknown>,
    payments: Record<string, unknown>,
    cashierId: string
  ): Promise<Sale> {
    const { data: rpcResult, error } = await supabase.rpc('checkout_complete', {
      p_shop_id: shopId,
      p_sale_data: saleData,
      p_payments: payments,
      p_cashier_id: cashierId,
    })

    if (error) {
      if (error.message?.includes('DAILY_LIMIT_REACHED')) {
        throw new DailyLimitError()
      }
      throw error
    }

    // RPC returns JSONB {sale_id, invoice_number}; extract sale_id for row fetch.
    const saleId = rpcResult?.sale_id ?? rpcResult
    const { data: row, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (fetchError) throw fetchError

    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id || undefined,
      customerName: row.customer_name || undefined,
      items: (row.items as CartItem[]) || [],
      subtotal: row.subtotal || 0,
      discountAmount: row.discount_amount || 0,
      taxAmount: row.tax_amount || 0,
      total: row.total || 0,
      paymentMethod: row.payment_method as Sale['paymentMethod'],
      payments: row.payments as Payment[] | undefined,
      cardDetails: row.card_details as CardDetails | undefined,
      status: row.status as Sale['status'],
      cashier: row.cashier || '',
      cashierId: row.cashier_id || undefined,
      timestamp: new Date(row.created_at),
      receiptNumber: row.receipt_number || undefined,
      notes: row.notes || undefined,
      appliedDiscounts: row.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: row.free_gifts as CartItem[] | undefined,
    }
  },
}
