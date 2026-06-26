import { CartItem, StockCheckResult } from '../types'
import { recipesService, recipeLinesService, rawMaterialsService } from './services'

/**
 * Pre-checkout stock validation.
 * Queries recipes + raw materials to verify sufficient stock before submitting sale.
 * Returns detailed result with any insufficient items.
 */
export async function checkStockAvailability(
  cartItems: CartItem[],
  _shopId: string
): Promise<StockCheckResult> {
  const insufficientItems: StockCheckResult['insufficientItems'] = []

  for (const item of cartItems) {
    const recipe = await recipesService.getByProductId(item.product.id)
    if (!recipe) continue // no recipe = no stock check needed

    const lines = await recipeLinesService.getByRecipeId(recipe.id)

    for (const line of lines) {
      if (line.isOptional) continue

      const needed = line.quantity * item.quantity * (1 + line.wastagePercent / 100)
      const material = await rawMaterialsService.getById(line.rawMaterialId)

      if (material.currentStock < needed) {
        insufficientItems.push({
          productName: item.product.name,
          rawMaterialName: material.name,
          needed,
          available: material.currentStock,
          unit: material.baseUnit,
        })
      }
    }
  }

  return {
    sufficient: insufficientItems.length === 0,
    insufficientItems,
  }
}
