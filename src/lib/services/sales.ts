import { supabase } from '../supabase'
import type { Sale, CartItem, Payment, CardDetails, AppliedDiscount } from '../../types'

export const salesService = {
  async getAll(
    { limit = 50, cursor = 0, shopId }: { limit?: number; cursor?: number; shopId?: string } = {}
  ): Promise<{ data: Sale[]; count: number; hasMore: boolean }> {
    let countQuery = supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })

    if (shopId) {
      countQuery = countQuery.eq('shop_id', shopId)
    }

    const { count, error: countError } = await countQuery

    if (countError) throw countError

    const from = cursor
    const to = cursor + limit - 1

    let dataQuery = supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (shopId) {
      dataQuery = dataQuery.eq('shop_id', shopId)
    }

    const { data, error } = await dataQuery.range(from, to)

    if (error) throw error

    const sales = data.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      customerId: sale.customer_id || undefined,
      customerName: sale.customer_name || undefined,
      items: (sale.items as CartItem[]) || [],
      subtotal: sale.subtotal || 0,
      discountAmount: sale.discount_amount || 0,
      taxAmount: sale.tax_amount || 0,
      total: sale.total || 0,
      paymentMethod: sale.payment_method as Sale['paymentMethod'],
      payments: sale.payments as Payment[] | undefined,
      cardDetails: sale.card_details as CardDetails | undefined,
      status: sale.status as Sale['status'],
      cashier: sale.cashier || '',
      timestamp: new Date(sale.created_at),
      receiptNumber: sale.receipt_number || undefined,
      notes: sale.notes || undefined,
      appliedDiscounts: sale.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: sale.free_gifts as CartItem[] | undefined,
    }))

    return {
      data: sales,
      count: count ?? 0,
      hasMore: cursor + limit < (count ?? 0)
    }
  },

  async create(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        invoice_number: sale.invoiceNumber,
        customer_id: sale.customerId,
        customer_name: sale.customerName,
        items: sale.items,
        subtotal: sale.subtotal,
        discount_amount: sale.discountAmount,
        tax_amount: sale.taxAmount,
        total: sale.total,
        payment_method: sale.paymentMethod,
        payments: sale.payments,
        card_details: sale.cardDetails,
        status: sale.status,
        cashier: sale.cashier,
        receipt_number: sale.receiptNumber,
        notes: sale.notes,
        applied_discounts: sale.appliedDiscounts,
        free_gifts: sale.freeGifts
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      customerId: data.customer_id || undefined,
      customerName: data.customer_name || undefined,
      items: (data.items as CartItem[]) || [],
      subtotal: data.subtotal || 0,
      discountAmount: data.discount_amount || 0,
      taxAmount: data.tax_amount || 0,
      total: data.total || 0,
      paymentMethod: data.payment_method as Sale['paymentMethod'],
      cardDetails: data.card_details as CardDetails | undefined,
      status: data.status as Sale['status'],
      cashier: data.cashier || '',
      timestamp: new Date(data.created_at),
      receiptNumber: data.receipt_number || undefined,
      notes: data.notes || undefined,
      appliedDiscounts: data.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: data.free_gifts as CartItem[] | undefined,
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
