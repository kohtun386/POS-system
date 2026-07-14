import { CartItem } from '../types'

/**
 * Simplified stock check — verifies product-level stock only.
 * ponytail: add supply-level stock validation when VISION.md §10 is revisited.
 * The checkout RPC handles server-side stock validation atomically.
 */
export async function checkStockAvailability(
  cartItems: CartItem[]
): Promise<{ sufficient: boolean; insufficientItems: Array<{ productName: string; needed: number; available: number }> }> {
  const insufficientItems: Array<{ productName: string; needed: number; available: number }> = []

  for (const item of cartItems) {
    if (item.product.trackInventory && item.product.stock < item.quantity) {
      insufficientItems.push({
        productName: item.product.name,
        needed: item.quantity,
        available: item.product.stock,
      })
    }
  }

  return {
    sufficient: insufficientItems.length === 0,
    insufficientItems,
  }
}
