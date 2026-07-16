import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must use vi.hoisted because vi.mock is hoisted above variable declarations
const { mockRpc, mockSingle } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('../../supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  },
}))

import { checkoutService, DailyLimitError } from '../../services'

describe('checkoutService.complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls checkout_complete RPC with correct params', async () => {
    // RPC returns the sale UUID; service then fetches the full row
    mockRpc.mockResolvedValue({ data: 'sale-1', error: null })
    mockSingle.mockResolvedValue({
      data: {
        id: 'sale-1',
        invoice_number: 'INV-001',
        items: [],
        subtotal: 100,
        discount_amount: 0,
        tax_amount: 0,
        total: 100,
        payment_method: 'cash',
        status: 'completed',
        created_at: '2026-07-01T10:00:00Z',
      },
      error: null,
    })

    const result = await checkoutService.complete(
      'shop-1',
      { items: [], total: 100 },
      [{ method: 'cash', amount: 100 }],
      'cashier-1',
    )

    expect(mockRpc).toHaveBeenCalledWith('checkout_complete', {
      p_shop_id: 'shop-1',
      p_sale_data: { items: [], total: 100 },
      p_payments: [{ method: 'cash', amount: 100 }],
      p_cashier_id: 'cashier-1',
    })
    expect(result.id).toBe('sale-1')
    expect(result.invoiceNumber).toBe('INV-001')
    expect(result.total).toBe(100)
  })

  it('throws DailyLimitError on DAILY_LIMIT_REACHED error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'DAILY_LIMIT_REACHED: Free tier limit exceeded' },
    })

    await expect(
      checkoutService.complete('shop-1', {}, [], 'cashier-1'),
    ).rejects.toThrow(DailyLimitError)
  })

  it('throws original error for non-limit RPC errors', async () => {
    const dbError = { message: 'Database connection failed' }
    mockRpc.mockResolvedValue({ data: null, error: dbError })

    await expect(
      checkoutService.complete('shop-1', {}, [], 'cashier-1'),
    ).rejects.toEqual(dbError)
  })

  it('maps all sale fields from RPC response', async () => {
    // RPC returns the sale UUID; service then fetches the full row
    mockRpc.mockResolvedValue({ data: 'sale-2', error: null })
    mockSingle.mockResolvedValue({
      data: {
        id: 'sale-2',
        invoice_number: 'INV-002',
        customer_id: 'cust-1',
        customer_name: 'Alice',
        items: [{ id: 'p1', name: 'Latte', quantity: 2, price: 5.5 }],
        subtotal: 11,
        discount_amount: 1,
        tax_amount: 0.5,
        total: 10.5,
        payment_method: 'card',
        status: 'completed',
        cashier: 'John',
        cashier_id: 'cashier-2',
        created_at: '2026-07-01T12:00:00Z',
        receipt_number: 'R-002',
        notes: 'Extra shot',
        applied_discounts: [],
        free_gifts: [],
      },
      error: null,
    })

    const result = await checkoutService.complete('shop-1', {}, [], 'cashier-2')

    expect(result.customerId).toBe('cust-1')
    expect(result.customerName).toBe('Alice')
    expect(result.discountAmount).toBe(1)
    expect(result.taxAmount).toBe(0.5)
    expect(result.paymentMethod).toBe('card')
    expect(result.cashier).toBe('John')
    expect(result.cashierId).toBe('cashier-2')
    expect(result.receiptNumber).toBe('R-002')
    expect(result.notes).toBe('Extra shot')
    expect(result.timestamp).toBeInstanceOf(Date)
  })
})

describe('DailyLimitError', () => {
  it('has correct name and default message', () => {
    const err = new DailyLimitError()
    expect(err.name).toBe('DailyLimitError')
    expect(err.message).toBe('Daily order limit reached. Upgrade to Growth.')
  })

  it('is instanceof Error', () => {
    expect(new DailyLimitError()).toBeInstanceOf(Error)
  })
})
