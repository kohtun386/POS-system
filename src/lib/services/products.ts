import { supabase } from '../supabase'
import type { Product, ProductBatch } from '../../types'
import { ProductLimitError } from './common'

interface RawProductBatch {
  id: string
  batch_number: string
  manufacturing_date: string
  expiry_date: string
  quantity: number
  cost_price: number
  supplier_info: string
}

export const productsService = {
  async getAll(shopId?: string): Promise<Product[]> {
    let query = supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name')

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error

    return data.map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || undefined,
      price: product.price || 0,
      cost: product.cost || 0,
      stock: product.stock || 0,
      minStock: product.min_stock || 0,
      category: product.category,
      description: product.description || '',
      image: product.image || undefined,
      taxable: product.taxable ?? true,
      active: product.active ?? true,
      isWeightBased: product.is_weight_based ?? false,
      pricePerUnit: product.price_per_unit || undefined,
      unit: product.unit || undefined,
      trackInventory: product.track_inventory ?? true,
      batches: [],
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at)
    }))
  },

  async getBatchesByProductId(productId: string): Promise<ProductBatch[]> {
    const { data, error } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', productId)
      .order('expiry_date', { ascending: true })

    if (error) throw error

    return data.map((batch: RawProductBatch) => ({
      id: batch.id,
      batchNumber: batch.batch_number,
      manufacturingDate: new Date(batch.manufacturing_date),
      expiryDate: new Date(batch.expiry_date),
      quantity: batch.quantity || 0,
      costPrice: batch.cost_price || 0,
      supplierInfo: batch.supplier_info || ''
    }))
  },

  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        min_stock: product.minStock,
        category: product.category,
        description: product.description,
        image: product.image,
        taxable: product.taxable,
        active: product.active,
        is_weight_based: product.isWeightBased,
        price_per_unit: product.pricePerUnit,
        unit: product.unit,
        track_inventory: product.trackInventory
      })
      .select()
      .single()

    if (error) {
      // Server-side guard (BEFORE INSERT trigger) raises 'Unable to create product'
      // when a Free-tier shop is at 50 active products. VISION.md §3.3 / §16.3.
      // Message is uniform to prevent tenant state disclosure (no shop existence or tier leak).
      if (error.message?.includes('Unable to create product')) {
        throw new ProductLimitError()
      }
      throw error
    }

    if (product.batches && product.batches.length > 0) {
      const batchesData = product.batches.map(batch => ({
        product_id: data.id,
        batch_number: batch.batchNumber,
        manufacturing_date: batch.manufacturingDate.toISOString().split('T')[0],
        expiry_date: batch.expiryDate.toISOString().split('T')[0],
        quantity: batch.quantity,
        cost_price: batch.costPrice,
        supplier_info: batch.supplierInfo
      }))

      await supabase.from('product_batches').insert(batchesData)
    }

    return this.getById(data.id)
  },

  async update(id: string, product: Partial<Product>): Promise<Product> {
    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        min_stock: product.minStock,
        category: product.category,
        description: product.description,
        image: product.image,
        taxable: product.taxable,
        active: product.active,
        is_weight_based: product.isWeightBased,
        price_per_unit: product.pricePerUnit,
        unit: product.unit,
        track_inventory: product.trackInventory
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (product.batches) {
      await supabase.from('product_batches').delete().eq('product_id', id)

      if (product.batches.length > 0) {
        const batchesData = product.batches.map(batch => ({
          product_id: id,
          batch_number: batch.batchNumber,
          manufacturing_date: batch.manufacturingDate.toISOString().split('T')[0],
          expiry_date: batch.expiryDate.toISOString().split('T')[0],
          quantity: batch.quantity,
          cost_price: batch.costPrice,
          supplier_info: batch.supplierInfo
        }))

        await supabase.from('product_batches').insert(batchesData)
      }
    }

    return this.getById(id)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getById(id: string): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_batches (*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode || undefined,
      price: data.price || 0,
      cost: data.cost || 0,
      stock: data.stock || 0,
      minStock: data.min_stock || 0,
      category: data.category,
      description: data.description || '',
      image: data.image || undefined,
      taxable: data.taxable ?? true,
      active: data.active ?? true,
      isWeightBased: data.is_weight_based ?? false,
      pricePerUnit: data.price_per_unit || undefined,
      unit: data.unit || undefined,
      batches: data.product_batches?.map((batch: RawProductBatch) => ({
        id: batch.id,
        batchNumber: batch.batch_number,
        manufacturingDate: new Date(batch.manufacturing_date),
        expiryDate: new Date(batch.expiry_date),
        quantity: batch.quantity || 0,
        costPrice: batch.cost_price || 0,
        supplierInfo: batch.supplier_info || ''
      })) || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}
