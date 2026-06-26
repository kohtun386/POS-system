import { CartItem, StockCheckResult } from '../types'
import { supabase } from './supabase'

/**
 * Pre-checkout stock validation.
 * Uses 3 batch queries instead of N*M sequential queries.
 * Returns detailed result with any insufficient items.
 */
export async function checkStockAvailability(
  cartItems: CartItem[],
  _shopId: string
): Promise<StockCheckResult> {
  const insufficientItems: StockCheckResult['insufficientItems'] = []

  // 1. Extract unique product IDs from cart
  const productIds = [...new Set(cartItems.map(item => item.product.id))]
  if (productIds.length === 0) {
    return { sufficient: true, insufficientItems: [] }
  }

  // 2. Fetch ALL recipes for these products in ONE query
  const { data: recipeRows, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .in('product_id', productIds)
    .eq('is_active', true)
  if (recipeError) throw recipeError

  // Build productId → recipe map
  const recipeByProductId = new Map<string, { id: string }>()
  for (const row of recipeRows || []) {
    recipeByProductId.set(row.product_id, { id: row.id })
  }

  // 3. Extract recipe IDs and fetch ALL recipe lines in ONE query
  const recipeIds = [...new Set((recipeRows || []).map(r => r.id))]
  if (recipeIds.length === 0) {
    return { sufficient: true, insufficientItems: [] }
  }

  const { data: lineRows, error: lineError } = await supabase
    .from('recipe_lines')
    .select('*')
    .in('recipe_id', recipeIds)
  if (lineError) throw lineError

  // Build recipeId → lines[] map
  const linesByRecipeId = new Map<string, Array<{ rawMaterialId: string; quantity: number; wastagePercent: number; isOptional: boolean }>>()
  const materialIds = new Set<string>()
  for (const row of lineRows || []) {
    const line = {
      rawMaterialId: row.raw_material_id,
      quantity: Number(row.quantity),
      wastagePercent: Number(row.wastage_percent),
      isOptional: row.is_optional,
    }
    if (!line.isOptional) materialIds.add(line.rawMaterialId)
    const existing = linesByRecipeId.get(row.recipe_id) || []
    existing.push(line)
    linesByRecipeId.set(row.recipe_id, existing)
  }

  // 4. Fetch ALL needed materials in ONE query
  const materialMap = new Map<string, { name: string; currentStock: number; baseUnit: string }>()
  if (materialIds.size > 0) {
    const { data: materialRows, error: materialError } = await supabase
      .from('raw_materials')
      .select('*')
      .in('id', [...materialIds])
    if (materialError) throw materialError

    for (const row of materialRows || []) {
      materialMap.set(row.id, {
        name: row.name,
        currentStock: Number(row.current_stock),
        baseUnit: row.base_unit,
      })
    }
  }

  // 5. Process cart items using in-memory lookups
  for (const item of cartItems) {
    const recipe = recipeByProductId.get(item.product.id)
    if (!recipe) continue // no recipe = no stock check needed

    const lines = linesByRecipeId.get(recipe.id)
    if (!lines) continue

    for (const line of lines) {
      if (line.isOptional) continue

      const needed = line.quantity * item.quantity * (1 + line.wastagePercent / 100)
      const material = materialMap.get(line.rawMaterialId)
      if (!material) continue

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
