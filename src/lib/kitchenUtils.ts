import { CartItem, KitchenOrderItem, KitchenStation } from '../types'

/**
 * Map product category to a kitchen station.
 * Falls back to 'bar' for unmapped categories.
 */
export function determineStation(category: string): KitchenStation {
  const map: Record<string, KitchenStation> = {
    // Espresso drinks
    'espresso': 'espresso',
    'coffee': 'espresso',
    'latte': 'espresso',
    'cappuccino': 'espresso',
    'americano': 'espresso',
    // Cold bar / blended
    'frappe': 'bar',
    'smoothie': 'bar',
    'juice': 'bar',
    'cold_brew': 'bar',
    'iced': 'bar',
    'cold drinks': 'bar',
    // Food
    'food': 'food',
    'sandwich': 'food',
    'toast': 'food',
    'wrap': 'food',
    'salad': 'food',
    'breakfast': 'food',
    'lunch': 'food',
    // Pastry / bakery
    'pastry': 'pastry',
    'bakery': 'pastry',
    'cake': 'pastry',
    'muffin': 'pastry',
    'croissant': 'pastry',
    'cookie': 'pastry',
    // Default
    'drinks': 'bar',
    'beverages': 'bar',
  }

  return map[category.toLowerCase().trim()] || 'bar'
}

/**
 * Convert cart items into kitchen order items.
 * All items are eligible by default (requiresPreparation defaults to true).
 */
export function cartItemsToKitchenItems(cart: CartItem[]): KitchenOrderItem[] {
  return cart.map(item => ({
    productName: item.product.name,
    quantity: item.quantity,
    productId: item.product.id,
    notes: item.discount > 0 ? `Discount applied: ${item.discount}` : undefined,
  }))
}

/**
 * Group cart items by their kitchen station.
 * Returns a map of station → kitchen items.
 */
export function groupByStation(cart: CartItem[]): Map<KitchenStation, KitchenOrderItem[]> {
  const grouped = new Map<KitchenStation, KitchenOrderItem[]>()

  for (const item of cart) {
    const station = determineStation(item.product.category)
    const existing = grouped.get(station) || []
    existing.push({
      productName: item.product.name,
      quantity: item.quantity,
      productId: item.product.id,
      notes: item.discount > 0 ? `Discount applied: ${item.discount}` : undefined,
    })
    grouped.set(station, existing)
  }

  return grouped
}
