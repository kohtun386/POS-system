import { describe, it, expect } from 'vitest'
import { checkDiscountEligibility } from '../../discountUtils'
import type { Discount, CartItem, Customer, DiscountCondition } from '../../../types'

// ── Helpers ─────────────────────────────────────────────────────────

const ALWAYS_VALID = {
  validFrom: new Date('2020-01-01'),
  validTo: new Date('2030-12-31'),
}

function makeDiscount(overrides: Partial<Discount> = {}): Discount {
  return {
    id: 'disc-1',
    name: 'Test Discount',
    type: 'percentage',
    value: 10,
    active: true,
    conditions: [],
    createdAt: new Date(),
    ...ALWAYS_VALID,
    ...overrides,
  }
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product: {
      id: 'p1',
      shopId: 'shop-1',
      name: 'Latte',
      sku: 'LAT-001',
      price: 5000,
      category: 'drinks',
      active: true,
      trackInventory: true,
      isWeightBased: false,
      taxable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    quantity: 2,
    discount: 0,
    discountType: 'fixed',
    subtotal: 10000,
    ...overrides,
  }
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    name: 'Test Customer',
    priceTier: 'regular',
    creditLimit: 100000,
    creditUsed: 0,
    totalPurchases: 50000,
    createdAt: new Date(),
    ...overrides,
  }
}

// ── Active flag ─────────────────────────────────────────────────────

describe('checkDiscountEligibility — active flag', () => {
  it('rejects inactive discount', () => {
    const discount = makeDiscount({ active: false })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(false)
  })

  it('accepts active discount with no conditions', () => {
    const discount = makeDiscount()
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(true)
  })
})

// ── Condition types ─────────────────────────────────────────────────

describe('min_amount condition', () => {
  it('passes when total >= condition value', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'min_amount', value: 10000 }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(true)
  })

  it('fails when total < condition value', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'min_amount', value: 20000 }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(false)
  })

  it('passes when total significantly exceeds threshold', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'min_amount', value: 5000 }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 100000)).toBe(true)
  })
})

describe('specific_products condition', () => {
  it('passes when required product in cart with sufficient quantity', () => {
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 3 })]
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: ['p1'], minQuantity: 2 }],
    })
    expect(checkDiscountEligibility(discount, cart, null, 'cash', 10000)).toBe(true)
  })

  it('fails when required product not in cart', () => {
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p2' }, quantity: 3 })]
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: ['p1'], minQuantity: 2 }],
    })
    expect(checkDiscountEligibility(discount, cart, null, 'cash', 10000)).toBe(false)
  })

  it('fails when quantity below minQuantity', () => {
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 1 })]
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: ['p1'], minQuantity: 2 }],
    })
    expect(checkDiscountEligibility(discount, cart, null, 'cash', 10000)).toBe(false)
  })

  it('defaults minQuantity to 1', () => {
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 1 })]
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: ['p1'] }],
    })
    expect(checkDiscountEligibility(discount, cart, null, 'cash', 10000)).toBe(true)
  })

  it('requires ALL listed products to be present', () => {
    const cart = [
      makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 1 }),
      // p2 missing
    ]
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: ['p1', 'p2'] }],
    })
    expect(checkDiscountEligibility(discount, cart, null, 'cash', 10000)).toBe(false)
  })

  it('rejects when value is not an array', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'specific_products', value: 'p1' as unknown as string[] }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(false)
  })
})

describe('payment_method condition', () => {
  it('passes when payment method matches', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'payment_method', value: 'card' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'card', 10000)).toBe(true)
  })

  it('fails when payment method does not match', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'payment_method', value: 'card' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(false)
  })

  it('matches digital payment methods', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'payment_method', value: 'kbzpay' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'kbzpay', 10000)).toBe(true)
  })
})

describe('customer_tier condition', () => {
  it('passes when customer tier matches', () => {
    const customer = makeCustomer({ priceTier: 'vip' })
    const discount = makeDiscount({
      conditions: [{ type: 'customer_tier', value: 'vip' }],
    })
    expect(checkDiscountEligibility(discount, [], customer, 'cash', 10000)).toBe(true)
  })

  it('fails when customer tier does not match', () => {
    const customer = makeCustomer({ priceTier: 'regular' })
    const discount = makeDiscount({
      conditions: [{ type: 'customer_tier', value: 'vip' }],
    })
    expect(checkDiscountEligibility(discount, [], customer, 'cash', 10000)).toBe(false)
  })

  it('fails when customer is null', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'customer_tier', value: 'vip' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(false)
  })
})

describe('card_type condition', () => {
  it('passes when card type matches and payment is card', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'card_type', value: 'visa' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'card', 10000, { cardType: 'visa' })).toBe(true)
  })

  it('fails when card type does not match', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'card_type', value: 'visa' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'card', 10000, { cardType: 'mastercard' })).toBe(false)
  })

  it('fails when payment method is cash even if cardType matches', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'card_type', value: 'visa' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000, { cardType: 'visa' })).toBe(false)
  })
})

describe('bank_name condition', () => {
  it('passes when bank name matches and payment is card', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'bank_name', value: 'KBZ Bank' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'card', 10000, { bankName: 'KBZ Bank' })).toBe(true)
  })

  it('fails when bank name does not match', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'bank_name', value: 'KBZ Bank' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'card', 10000, { bankName: 'AYA Bank' })).toBe(false)
  })

  it('fails when payment is cash', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'bank_name', value: 'KBZ Bank' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000, { bankName: 'KBZ Bank' })).toBe(false)
  })
})

// ── Multiple conditions (AND logic) ────────────────────────────────

describe('multiple conditions (AND logic)', () => {
  it('passes only when ALL conditions are met', () => {
    const customer = makeCustomer({ priceTier: 'vip' })
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 2 })]
    const discount = makeDiscount({
      conditions: [
        { type: 'min_amount', value: 5000 },
        { type: 'specific_products', value: ['p1'], minQuantity: 2 },
        { type: 'customer_tier', value: 'vip' },
      ],
    })
    expect(checkDiscountEligibility(discount, cart, customer, 'cash', 10000)).toBe(true)
  })

  it('fails when any one condition is not met', () => {
    const customer = makeCustomer({ priceTier: 'regular' }) // wrong tier
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 2 })]
    const discount = makeDiscount({
      conditions: [
        { type: 'min_amount', value: 5000 },
        { type: 'specific_products', value: ['p1'], minQuantity: 2 },
        { type: 'customer_tier', value: 'vip' },
      ],
    })
    expect(checkDiscountEligibility(discount, cart, customer, 'cash', 10000)).toBe(false)
  })

  it('fails when min_amount not met but other conditions pass', () => {
    const customer = makeCustomer({ priceTier: 'vip' })
    const cart = [makeCartItem({ product: { ...makeCartItem().product, id: 'p1' }, quantity: 2 })]
    const discount = makeDiscount({
      conditions: [
        { type: 'min_amount', value: 50000 }, // total is only 10000
        { type: 'specific_products', value: ['p1'], minQuantity: 2 },
        { type: 'customer_tier', value: 'vip' },
      ],
    })
    expect(checkDiscountEligibility(discount, cart, customer, 'cash', 10000)).toBe(false)
  })
})

// ── Unknown condition type ──────────────────────────────────────────

describe('unknown condition type', () => {
  it('passes for unrecognized condition type (forward-compat)', () => {
    const discount = makeDiscount({
      conditions: [{ type: 'unknown_future_type' as DiscountCondition['type'], value: 'x' }],
    })
    expect(checkDiscountEligibility(discount, [], null, 'cash', 10000)).toBe(true)
  })
})

// ── Auto-discount calculation (CheckoutModal logic) ─────────────────
// Pure math extracted from CheckoutModal.tsx useEffect — tests the
// calculation, not React rendering.

describe('auto-discount calculation', () => {
  function calcAutoDiscount(discount: Discount, subtotal: number): number {
    if (discount.type === 'percentage') {
      let amount = (subtotal * (discount.value ?? 0)) / 100
      if (discount.maxDiscount) {
        amount = Math.min(amount, discount.maxDiscount)
      }
      return Math.min(amount, subtotal) // ponytail: clamped to subtotal
    } else if (discount.type === 'fixed') {
      return Math.min(discount.value ?? 0, subtotal) // ponytail: clamped to subtotal
    }
    return 0
  }

  it('percentage discount on subtotal', () => {
    const d = makeDiscount({ type: 'percentage', value: 10 })
    expect(calcAutoDiscount(d, 50000)).toBe(5000)
  })

  it('percentage discount respects maxDiscount cap', () => {
    // 20% of 100000 = 20000, but capped at 15000
    const d = makeDiscount({ type: 'percentage', value: 20, maxDiscount: 15000 })
    expect(calcAutoDiscount(d, 100000)).toBe(15000)
  })

  it('percentage discount uses full value when below cap', () => {
    const d = makeDiscount({ type: 'percentage', value: 10, maxDiscount: 15000 })
    expect(calcAutoDiscount(d, 100000)).toBe(10000)
  })

  it('fixed discount returns value clamped to subtotal', () => {
    const d = makeDiscount({ type: 'fixed', value: 7500 })
    expect(calcAutoDiscount(d, 50000)).toBe(7500)
    expect(calcAutoDiscount(d, 1000)).toBe(1000) // ponytail: clamped to subtotal
  })

  it('free_gift discount returns 0 amount (product added separately)', () => {
    const d = makeDiscount({ type: 'free_gift' })
    expect(calcAutoDiscount(d, 50000)).toBe(0)
  })

  it('percentage with no maxDiscount has no ceiling', () => {
    const d = makeDiscount({ type: 'percentage', value: 50 })
    expect(calcAutoDiscount(d, 200000)).toBe(100000)
  })
})
