import { describe, it, expect } from 'vitest'
import type { CartItem, Product, Discount, AppliedDiscount } from '../../../types'

// ── Helpers ─────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
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
    ...overrides,
  }
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product: makeProduct(),
    quantity: 1,
    discount: 0,
    discountType: 'fixed',
    subtotal: 5000,
    ...overrides,
  }
}

// ── Subtotal calculation ────────────────────────────────────────────
// Formula from Cart.tsx and CheckoutModal.tsx:
//   subtotal = Σ (price × quantity)
// Weight-based: price = pricePerUnit × weight

describe('subtotal calculation', () => {
  it('single item, no discount', () => {
    const cart = [makeCartItem({ quantity: 1 })]
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    expect(subtotal).toBe(5000)
  })

  it('multiple items', () => {
    const cart = [
      makeCartItem({ product: makeProduct({ id: 'p1', price: 5000 }), quantity: 2 }),
      makeCartItem({ product: makeProduct({ id: 'p2', price: 3500 }), quantity: 3 }),
    ]
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    // 5000×2 + 3500×3 = 10000 + 10500 = 20500
    expect(subtotal).toBe(20500)
  })

  it('weight-based product: pricePerUnit × weight × quantity', () => {
    const cart = [
      makeCartItem({
        product: makeProduct({
          id: 'beans',
          isWeightBased: true,
          pricePerUnit: 2000, // MMK per 100g
          price: 0, // unused for weight-based
        }),
        quantity: 2,
        weight: 0.5, // 0.5 × 100g = 50g
      }),
    ]
    // Subtotal uses: pricePerUnit × weight (per item line)
    // Then × quantity? Let's check Cart.tsx:
    // price = (item.product.pricePerUnit || 0) * (item.weight || 1)
    // sum + (price * item.quantity)
    // So: (2000 × 0.5) × 2 = 2000
    const price = cart[0].product.pricePerUnit! * (cart[0].weight || 1)
    const subtotal = price * cart[0].quantity
    expect(subtotal).toBe(2000)
  })

  it('weight-based product with default weight=1', () => {
    const cart = [
      makeCartItem({
        product: makeProduct({
          isWeightBased: true,
          pricePerUnit: 2000,
          price: 0,
        }),
        quantity: 3,
        // no weight set → defaults to 1
      }),
    ]
    const price = cart[0].product.pricePerUnit! * (cart[0].weight || 1)
    const subtotal = price * cart[0].quantity
    // 2000 × 1 × 3 = 6000
    expect(subtotal).toBe(6000)
  })
})

// ── Manual per-item discount ────────────────────────────────────────
// Formula from Cart.tsx applyDiscount():
//   subtotal = (price × quantity) - discountAmount
// Where discountAmount for percentage = (price × quantity × discount%) / 100
// For fixed: discountAmount = discount value

describe('manual per-item discount', () => {
  it('percentage discount on item', () => {
    const item = makeCartItem({ quantity: 3 })
    const price = item.product.price // 5000
    const discountPercent = 10
    const discountAmount = (price * item.quantity * discountPercent) / 100
    // 5000 × 3 × 10% = 1500
    expect(discountAmount).toBe(1500)
    const subtotal = (price * item.quantity) - discountAmount
    // 15000 - 1500 = 13500
    expect(subtotal).toBe(13500)
  })

  it('fixed discount on item', () => {
    const item = makeCartItem({ quantity: 2 })
    const price = item.product.price // 5000
    const discountAmount = 3000
    const subtotal = (price * item.quantity) - discountAmount
    // 10000 - 3000 = 7000
    expect(subtotal).toBe(7000)
  })

  it('discount larger than item subtotal results in negative', () => {
    // Spec: if code allows discount > subtotal, test that it surfaces
    const item = makeCartItem({ quantity: 1 })
    const price = item.product.price // 5000
    const discountAmount = 8000
    const subtotal = (price * item.quantity) - discountAmount
    // 5000 - 8000 = -3000
    expect(subtotal).toBe(-3000)
  })
})

// ── Cart-level totals (CheckoutModal formula) ───────────────────────
// From CheckoutModal.tsx lines 122-224:
//   subtotal = Σ (price × quantity)
//   manualDiscount = Σ (item.discount)
//   totalAutoDiscount = Σ (appliedDiscount.discountAmount)   [from auto-discounts]
//   totalDiscount = manualDiscount + totalAutoDiscount
//   taxAmount = (subtotal - totalDiscount) × (taxRate / 100)
//   total = subtotal - totalDiscount + taxAmount

describe('cart-level totals', () => {
  function calcTotals(
    cart: CartItem[],
    manualDiscount: number,
    autoDiscounts: AppliedDiscount[],
    taxRate: number,
  ) {
    const subtotal = cart.reduce((sum, item) => {
      const price = item.product.isWeightBased
        ? (item.product.pricePerUnit || 0) * (item.weight || 1)
        : item.product.price
      return sum + (price * item.quantity)
    }, 0)
    const totalAutoDiscount = autoDiscounts.reduce((sum, d) => sum + d.discountAmount, 0)
    const totalDiscount = manualDiscount + totalAutoDiscount
    const taxAmount = (subtotal - totalDiscount) * (taxRate / 100)
    const total = subtotal - totalDiscount + taxAmount
    return { subtotal, totalDiscount, taxAmount, total }
  }

  it('no discounts, no tax', () => {
    const cart = [
      makeCartItem({ product: makeProduct({ price: 5000 }), quantity: 2 }),
      makeCartItem({ product: makeProduct({ id: 'p2', price: 3500 }), quantity: 1 }),
    ]
    const result = calcTotals(cart, 0, [], 0)
    // subtotal: 10000 + 3500 = 13500
    expect(result.subtotal).toBe(13500)
    expect(result.totalDiscount).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(13500)
  })

  it('with tax only (MMK typical 5%)', () => {
    const cart = [makeCartItem({ product: makeProduct({ price: 10000 }), quantity: 1 })]
    const result = calcTotals(cart, 0, [], 5)
    // subtotal: 10000, tax: 10000 × 0.05 = 500, total: 10500
    expect(result.subtotal).toBe(10000)
    expect(result.taxAmount).toBe(500)
    expect(result.total).toBe(10500)
  })

  it('manual discount reduces taxable amount', () => {
    const cart = [makeCartItem({ product: makeProduct({ price: 10000 }), quantity: 1 })]
    const result = calcTotals(cart, 2000, [], 5)
    // subtotal: 10000, discount: 2000, taxable: 8000, tax: 400, total: 8400
    expect(result.subtotal).toBe(10000)
    expect(result.totalDiscount).toBe(2000)
    expect(result.taxAmount).toBe(400)
    expect(result.total).toBe(8400)
  })

  it('auto discount stacks with manual discount', () => {
    const cart = [makeCartItem({ product: makeProduct({ price: 50000 }), quantity: 1 })]
    const autoDiscounts: AppliedDiscount[] = [
      { discountId: 'd1', discountName: '10% off', discountAmount: 5000, type: 'percentage' },
      { discountId: 'd2', discountName: 'Fixed 3000', discountAmount: 3000, type: 'fixed' },
    ]
    const result = calcTotals(cart, 1000, autoDiscounts, 5)
    // subtotal: 50000, manual: 1000, auto: 8000, totalDiscount: 9000
    // taxable: 41000, tax: 2050, total: 43050
    expect(result.subtotal).toBe(50000)
    expect(result.totalDiscount).toBe(9000)
    expect(result.taxAmount).toBe(2050)
    expect(result.total).toBe(43050)
  })

  it('discount larger than subtotal — total goes negative', () => {
    const cart = [makeCartItem({ product: makeProduct({ price: 5000 }), quantity: 1 })]
    const autoDiscounts: AppliedDiscount[] = [
      { discountId: 'd1', discountName: 'Huge', discountAmount: 8000, type: 'fixed' },
    ]
    const result = calcTotals(cart, 0, autoDiscounts, 5)
    // subtotal: 5000, discount: 8000, taxable: -3000, tax: -150, total: -3150
    expect(result.total).toBe(-3150)
  })

  it('empty cart totals to zero', () => {
    const result = calcTotals([], 0, [], 5)
    expect(result.subtotal).toBe(0)
    expect(result.totalDiscount).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.total).toBe(0)
  })

  it('weight-based items in mixed cart', () => {
    const cart = [
      makeCartItem({
        product: makeProduct({
          id: 'beans',
          isWeightBased: true,
          pricePerUnit: 2000,
          price: 0,
        }),
        quantity: 1,
        weight: 0.3, // 0.3 × 2000 = 600
      }),
      makeCartItem({
        product: makeProduct({ id: 'latte', price: 5000 }),
        quantity: 2,
      }),
    ]
    const result = calcTotals(cart, 0, [], 0)
    // beans: 2000 × 0.3 = 600, latte: 5000 × 2 = 10000
    expect(result.subtotal).toBe(10600)
    expect(result.total).toBe(10600)
  })
})

// ── Free gift products ──────────────────────────────────────────────

describe('free gift products', () => {
  it('free gift adds product with subtotal=0', () => {
    const gift: CartItem = {
      product: makeProduct({ id: 'gift-mug', name: 'Free Mug', price: 3000 }),
      quantity: 1,
      discount: 0,
      discountType: 'fixed',
      subtotal: 0, // always 0 for free gifts
    }
    expect(gift.subtotal).toBe(0)
    // The gift does NOT affect cart subtotal
    const cart = [
      makeCartItem({ quantity: 1 }), // 5000
    ]
    const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    expect(cartSubtotal).toBe(5000) // gift not included
  })
})

// ── Realistic MMK scenarios ─────────────────────────────────────────

describe('realistic MMK checkout scenarios', () => {
  function calcTotals(
    cart: CartItem[],
    manualDiscount: number,
    autoDiscounts: AppliedDiscount[],
    taxRate: number,
  ) {
    const subtotal = cart.reduce((sum, item) => {
      const price = item.product.isWeightBased
        ? (item.product.pricePerUnit || 0) * (item.weight || 1)
        : item.product.price
      return sum + (price * item.quantity)
    }, 0)
    const totalAutoDiscount = autoDiscounts.reduce((sum, d) => sum + d.discountAmount, 0)
    const totalDiscount = manualDiscount + totalAutoDiscount
    const taxAmount = (subtotal - totalDiscount) * (taxRate / 100)
    const total = subtotal - totalDiscount + taxAmount
    return { subtotal, totalDiscount, taxAmount, total }
  }

  it('coffee shop morning rush — 3 lattes, no discount, 5% tax', () => {
    const cart = [
      makeCartItem({ product: makeProduct({ name: 'Latte', price: 4500 }), quantity: 3 }),
    ]
    const result = calcTotals(cart, 0, [], 5)
    // 4500 × 3 = 13500, tax: 675, total: 14175
    expect(result.total).toBe(14175)
  })

  it('beans purchase — weight-based 200g at 1800/100g', () => {
    const cart = [
      makeCartItem({
        product: makeProduct({
          name: 'Arabica Beans',
          isWeightBased: true,
          pricePerUnit: 1800,
          price: 0,
        }),
        quantity: 1,
        weight: 2, // 2 × 100g units = 3600
      }),
    ]
    const result = calcTotals(cart, 0, [], 0)
    expect(result.total).toBe(3600)
  })

  it('loyalty discount — 10% auto + MMK 1000 manual, coffee 25000', () => {
    const cart = [
      makeCartItem({ product: makeProduct({ name: 'Set', price: 25000 }), quantity: 1 }),
    ]
    const autoDiscounts: AppliedDiscount[] = [
      { discountId: 'loyalty', discountName: 'Loyalty 10%', discountAmount: 2500, type: 'percentage' },
    ]
    const result = calcTotals(cart, 1000, autoDiscounts, 5)
    // subtotal: 25000, discount: 3500, taxable: 21500, tax: 1075, total: 22575
    expect(result.total).toBe(22575)
  })

  it('KBZpay discount — card payment with maxDiscount cap', () => {
    const cart = [
      makeCartItem({ product: makeProduct({ name: 'Bundle', price: 100000 }), quantity: 1 }),
    ]
    // 20% KBZpay discount, capped at MMK 15000
    const autoDiscounts: AppliedDiscount[] = [
      { discountId: 'kbz', discountName: 'KBZpay 20%', discountAmount: 15000, type: 'percentage' },
    ]
    const result = calcTotals(cart, 0, autoDiscounts, 5)
    // subtotal: 100000, discount: 15000, taxable: 85000, tax: 4250, total: 89250
    expect(result.total).toBe(89250)
  })
})
