import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase module — build chainable query builder
// Must use vi.hoisted because vi.mock is hoisted above variable declarations
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('../../supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createMockQuery(returnData: unknown = null, returnError: { message: string } | null = null) {
  const result = { data: returnData, error: returnError }
  const chain: Record<string, unknown> = {} as Record<string, unknown>

  // Chain methods return the chain itself
  for (const method of ['select', 'insert', 'update', 'order', 'limit', 'eq']) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

  // Terminal methods return resolved promise
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  chain.single = vi.fn().mockResolvedValue(result)

  // Make chain thenable so `await supabase.from(...).select('*')...` resolves
  chain.then = (onFulfilled: ((value: typeof result) => unknown) | null, onRejected: ((reason: unknown) => unknown) | null) =>
    Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined)
  chain.catch = (onRejected: ((reason: unknown) => unknown) | null) => Promise.resolve(result).catch(onRejected ?? undefined)

  return chain
}

import { cashShiftsService } from '../../services'

describe('cashShiftsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOpenByCashier', () => {
    it('returns null when no open shift exists', async () => {
      const chain = createMockQuery(null)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.getOpenByCashier('cashier-1')
      expect(result).toBeNull()
      expect(mockFrom).toHaveBeenCalledWith('cash_shifts')
      expect(chain.eq).toHaveBeenCalledWith('cashier_id', 'cashier-1')
      expect(chain.eq).toHaveBeenCalledWith('status', 'open')
    })

    it('returns mapped CashShift when open shift exists', async () => {
      const row = {
        id: 'shift-1',
        shop_id: 'shop-1',
        cashier_id: 'cashier-1',
        opening_cash: 50000,
        status: 'open',
        opened_at: '2026-07-01T08:00:00Z',
      }
      const chain = createMockQuery(row)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.getOpenByCashier('cashier-1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('shift-1')
      expect(result!.shopId).toBe('shop-1')
      expect(result!.openingCash).toBe(50000)
      expect(result!.status).toBe('open')
      expect(result!.openedAt).toBeInstanceOf(Date)
    })
  })

  describe('create', () => {
    it('inserts new cash shift with correct snake_case fields', async () => {
      const row = {
        id: 'shift-2',
        shop_id: 'shop-1',
        cashier_id: 'cashier-1',
        opening_cash: 30000,
        status: 'open',
        opened_at: '2026-07-01T09:00:00Z',
      }
      const chain = createMockQuery(row)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.create({
        shopId: 'shop-1',
        cashierId: 'cashier-1',
        openingCash: 30000,
      })

      expect(chain.insert).toHaveBeenCalledWith({
        shop_id: 'shop-1',
        cashier_id: 'cashier-1',
        opening_cash: 30000,
        status: 'open',
      })
      expect(result.id).toBe('shift-2')
      expect(result.status).toBe('open')
    })

    it('throws on database error', async () => {
      const chain = createMockQuery(null, { message: 'Insert failed' })
      mockFrom.mockReturnValue(chain)

      await expect(
        cashShiftsService.create({ shopId: 'shop-1', cashierId: 'c1', openingCash: 10000 }),
      ).rejects.toThrow()
    })
  })

  describe('close', () => {
    it('calculates variance and updates status to closed', async () => {
      const row = {
        id: 'shift-1',
        shop_id: 'shop-1',
        cashier_id: 'cashier-1',
        opening_cash: 50000,
        closing_cash: 55000,
        expected_cash: 54000,
        variance: 1000,
        status: 'closed',
        opened_at: '2026-07-01T08:00:00Z',
        closed_at: '2026-07-01T17:00:00Z',
      }
      const chain = createMockQuery(row)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.close('shift-1', 55000, 54000)

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          closing_cash: 55000,
          expected_cash: 54000,
          variance: 1000,
          status: 'closed',
        }),
      )
      expect(result.closingCash).toBe(55000)
      expect(result.expectedCash).toBe(54000)
      expect(result.variance).toBe(1000)
      expect(result.status).toBe('closed')
    })

    it('handles close without expectedCash', async () => {
      const row = {
        id: 'shift-1',
        shop_id: 'shop-1',
        cashier_id: 'cashier-1',
        opening_cash: 50000,
        closing_cash: 55000,
        expected_cash: null,
        variance: null,
        status: 'closed',
        opened_at: '2026-07-01T08:00:00Z',
        closed_at: '2026-07-01T17:00:00Z',
      }
      const chain = createMockQuery(row)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.close('shift-1', 55000)

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          closing_cash: 55000,
          expected_cash: undefined,
          variance: undefined,
        }),
      )
      expect(result.expectedCash).toBeUndefined()
      expect(result.variance).toBeUndefined()
    })
  })

  describe('getByShopId', () => {
    it('returns mapped array of cash shifts ordered by opened_at desc', async () => {
      const rows = [
        {
          id: 'shift-2',
          shop_id: 'shop-1',
          cashier_id: 'cashier-2',
          opening_cash: 40000,
          status: 'closed',
          opened_at: '2026-07-02T08:00:00Z',
        },
        {
          id: 'shift-1',
          shop_id: 'shop-1',
          cashier_id: 'cashier-1',
          opening_cash: 50000,
          status: 'open',
          opened_at: '2026-07-01T08:00:00Z',
        },
      ]
      const chain = createMockQuery(rows)
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.getByShopId('shop-1', 2)

      expect(chain.eq).toHaveBeenCalledWith('shop_id', 'shop-1')
      expect(chain.order).toHaveBeenCalledWith('opened_at', { ascending: false })
      expect(chain.limit).toHaveBeenCalledWith(2)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('shift-2')
      expect(result[1].id).toBe('shift-1')
    })

    it('returns empty array when no shifts exist', async () => {
      const chain = createMockQuery([])
      mockFrom.mockReturnValue(chain)

      const result = await cashShiftsService.getByShopId('shop-1')
      expect(result).toEqual([])
    })
  })
})
