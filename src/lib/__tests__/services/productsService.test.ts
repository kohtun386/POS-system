import { describe, it, expect, vi, beforeEach } from 'vitest'

// products.ts imports { supabase } from '../supabase' (src/lib/supabase.ts)
vi.mock('../../supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  }
})

// Import after mock (hoisted). Service module path: src/lib/services/products.ts
import { productsService } from '../../services/products'
import { ProductLimitError } from '../../services/common'

// Refs to the mocked supabase object
import { supabase } from '../../supabase'

// Type helper: cast supabase.from as a jest-style mock fn
const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>

function mockInsertResolving(error: unknown) {
  fromMock.mockReturnValue({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error }),
      })),
    })),
  })
}

const baseProduct = {
  name: 'Test',
  sku: 'TEST-1',
  price: 1000,
  cost: 500,
  stock: 1,
  minStock: 1,
  category: 'Test',
  description: '',
  taxable: true,
  active: true,
  isWeightBased: false,
  trackInventory: true,
}

describe('productsService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws ProductLimitError when the trigger raises unable to create product', async () => {
    // The BEFORE INSERT trigger (enforce_free_tier_product_limit) raises
    // 'Unable to create product' for a Free-tier shop at 50 active products.
    // Uniform message prevents tenant state disclosure.
    mockInsertResolving({
      message: 'Unable to create product',
    })

    await expect(productsService.create(baseProduct)).rejects.toThrow(ProductLimitError)
  })

  it('throws original error for non-limit DB errors', async () => {
    const dbError = { message: 'Database connection failed' }
    mockInsertResolving(dbError)

    await expect(productsService.create(baseProduct)).rejects.toEqual(dbError)
  })
})

describe('ProductLimitError', () => {
  it('has correct name and default message', () => {
    const err = new ProductLimitError()
    expect(err.name).toBe('ProductLimitError')
    expect(err.message).toBe('Product limit reached. Upgrade to Growth.')
  })

  it('is instanceof Error', () => {
    expect(new ProductLimitError()).toBeInstanceOf(Error)
  })
})
