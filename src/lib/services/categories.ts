import { supabase } from '../supabase'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../../types'
import type { Database } from '../database.types'

/**
 * Categories Service (Phase 1 Foundation)
 *
 * Provides typed category management with shop isolation.
 * During transition: products.category (string) + products.category_id (FK) coexist.
 *
 * Phase 1 constraints (per ADR 006):
 * - create: trim + ILIKE duplicate check, throw on duplicate
 * - update: description + active ONLY (no rename exposed)
 * - deactivation allowed even with referencing products
 * - hard delete blocked while getProductCount > 0
 */

interface DbCategoryRow {
  id: string
  shop_id: string
  name: string
  description: string | null
  active: boolean | null
  created_at: string
  updated_at: string
}

function mapCategory(row: DbCategoryRow): Category {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    description: row.description || undefined,
    active: row.active ?? true,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export const categoriesService = {
  /**
   * Get all active categories for a shop (for product selection)
   */
  async getActive(shopId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('name')

    if (error) throw error
    return data.map(mapCategory)
  },

  /**
   * Get all categories for management UI (including inactive)
   */
  async getAll(shopId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')

    if (error) throw error
    return data.map(mapCategory)
  },

  /**
   * Create a new category
   * C1: trim + ILIKE duplicate check, throw on duplicate
   */
  async create(shopId: string, input: CreateCategoryInput): Promise<Category> {
    const trimmedName = input.name.trim()

    if (!trimmedName) {
      throw new Error('Category name is required')
    }

    // Case-insensitive duplicate check at application layer
    // (database unique expression index provides final guarantee)
    const { data: existing, error: checkError } = await supabase
      .from('categories')
      .select('id')
      .eq('shop_id', shopId)
      .ilike('name', trimmedName)
      .single()

    if (checkError && checkError.code !== 'PG1101') {
      throw checkError
    }

    if (existing) {
      throw new Error('Category name already exists')
    }

    const { data, error } = await supabase
      .from('categories')
      .insert({
        shop_id: shopId,
        name: trimmedName,
        description: input.description?.trim() || null,
        active: true,
      } as Database['public']['Tables']['categories']['Insert'])
      .select()
      .single()

    if (error) throw error

    return mapCategory(data)
  },

  /**
   * Update an existing category
   * C2: description + active ONLY (no rename exposed)
   * No name field is accepted — rename is deferred
   */
  async update(id: string, updates: UpdateCategoryInput): Promise<Category> {
    // Only update description and active; ignore name if provided
    const dbUpdates: Partial<{ description: string | null; active: boolean }> = {}

    if (updates.description !== undefined) {
      dbUpdates.description = updates.description?.trim() || null
    }
    if (updates.active !== undefined) {
      dbUpdates.active = updates.active
    }

    if (Object.keys(dbUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    const { data, error } = await supabase
      .from('categories')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return mapCategory(data)
  },

  /**
   * Deactivate a category (soft delete)
   * C3: deactivation allowed even when products reference the category
   */
  async deactivate(id: string): Promise<void> {
    // Verify category exists
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, shop_id, name')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!category) throw new Error('Category not found')

    const { error } = await supabase
      .from('categories')
      .update({ active: false })
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Hard-delete a category (Phase 1: blocked if in use)
   * C4: hard delete blocked while getProductCount > 0
   */
  async delete(id: string): Promise<void> {
    // Fetch category to get name and shop_id
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('name, shop_id')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!category) throw new Error('Category not found')

    // Count products using this category name (string-based read path)
    const productCount = await this.getProductCount(category.shop_id, category.name)

    if (productCount > 0) {
      throw new Error(
        `Cannot delete category "${category.name}" — ${productCount} product(s) still use it. Deactivate instead.`
      )
    }

    // Hard delete is allowed only when no products reference the category
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Count products referencing a category by name (string-based read path)
   * Used by delete() to enforce soft-delete-while-in-use behavior
   */
  async getProductCount(shopId: string, categoryName: string): Promise<number> {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('category', categoryName)

    if (error) throw error

    return count || 0
  },

  /**
   * Get a category by ID with shop scoping
   */
  async getById(id: string, shopId: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .single()

    if (error && error.code === 'PG1101') return null
    if (error) throw error

    return mapCategory(data)
  },
}