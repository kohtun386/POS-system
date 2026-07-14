// Raw DB row shape for product_batches
interface RawProductBatch {
  id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  quantity: number;
  cost_price: number;
  supplier_info: string;
}

import { supabase } from './supabase'
import {
  Product,
  ProductBatch,
  Customer,
  CartItem,
  Sale,
  Discount,
  DiscountCondition,
  Payment,
  CardDetails,
  AppliedDiscount,
  User,
  AppSettings,
  SalesTab,
  AlertRecipient,
  AlertTemplate,
  AlertConfiguration,
  AlertHistory,
  NotificationServiceConfig,
  Shop,
  FeatureDefinition,
  ShopFeature,
  CashShift,
  CapabilityResolution,
  PrintJob,
  PrintJobStatus
} from '../types'

// ================================================================
// Error Classes
// ================================================================

export class DailyLimitError extends Error {
  constructor(message = 'Daily order limit reached. Upgrade to Growth.') {
    super(message)
    this.name = 'DailyLimitError'
  }
}

// ================================================================
// Helper: map DB row → Shop (shared by shopsService + shopMembershipsService)
// ================================================================

function mapShopRow(row: Record<string, unknown>): Shop {
  return {
    id: row.id as string,
    name: (row.name as string) || '',
    address: (row.address as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    logo: (row.logo as string) || undefined,
    ownerId: (row.owner_id as string) || undefined,
    businessType: (row.business_type as string) || 'coffee_shop',
    taxRate: Number(row.tax_rate ?? 0),
    invoicePrefix: (row.invoice_prefix as string) || 'INV',
    invoiceCounter: (row.invoice_counter as number) ?? 0,
    draftRetentionDays: (row.draft_retention_days as number) ?? 30,
    subscriptionTier: (row.subscription_tier as string) || 'free',
    dailyOrderLimit: (row.daily_order_limit as number) ?? undefined,
    receiptSetting: (row.receipt_setting as string) || 'ask',
    isActive: (row.is_active as boolean) ?? true,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}

// ================================================================
// Capability Resolution (VISION §5)
// ================================================================

const TIER_HIERARCHY: Record<string, number> = { free: 0, growth: 1, pro: 2 }

/**
 * Resolve capabilities for a shop based on subscription tier + overrides.
 *
 * Precedence (TIER-SPEC §3.3 — Flexible model):
 *   1. Per-shop override (shop_features) — ALWAYS wins, can beat tier gate
 *   2. Tier gate + default_enabled — fallback when no override exists
 *
 * A platform admin can enable a Pro feature on a Free shop for trials.
 * Returns flat string[] of capability keys the shop can access.
 */
export function resolveCapabilities(
  shop: Shop,
  definitions: FeatureDefinition[],
  overrides: ShopFeature[]
): string[] {
  const shopTierLevel = TIER_HIERARCHY[shop.subscriptionTier] ?? 0

  // Build override map: feature_key → enabled
  const overrideMap = new Map<string, boolean>()
  for (const o of overrides) {
    overrideMap.set(o.featureKey, o.enabled)
  }

  const caps: string[] = []

  for (const def of definitions) {
    // Check per-shop override FIRST (overrides always win — TIER-SPEC §3.3)
    const override = overrideMap.get(def.key)

    if (override !== undefined) {
      // Override exists: use it regardless of tier gate
      if (override) {
        caps.push(def.key)
      }
    } else {
      // No override: apply tier gate + default
      const defTierLevel = TIER_HIERARCHY[def.subscriptionTier] ?? 0
      if (shopTierLevel >= defTierLevel && def.defaultEnabled) {
        caps.push(def.key)
      }
    }
  }

  return caps
}

/**
 * Server-side capability resolution via RPC (VISION §5).
 * Returns flat string[] of capability keys for a shop.
 * Precedence: shop_features override > feature_definitions tier gate.
 */
export async function resolveCapabilitiesRpc(shopId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('resolve_capabilities', {
    p_shop_id: shopId,
  })

  if (error) {
    console.error('Failed to resolve capabilities via RPC:', error)
    throw error
  }

  return data ?? []
}

// Products Service
export const productsService = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name')

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
      batches: [], // Lazy-loaded via getBatchesByProductId()
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

    if (error) throw error

    // Insert batches if any
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

    // Update batches if provided
    if (product.batches) {
      // Delete existing batches
      await supabase.from('product_batches').delete().eq('product_id', id)

      // Insert new batches
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

// Customers Service
export const customersService = {
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      creditLimit: customer.credit_limit || 0,
      creditUsed: customer.credit_used || 0,
      priceTier: customer.price_tier || 'Standard',
      totalPurchases: customer.total_purchases || 0,
      lastPurchase: customer.last_purchase ? new Date(customer.last_purchase) : undefined,
      createdAt: new Date(customer.created_at)
    }))
  },

  async create(customer: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        credit_limit: customer.creditLimit,
        credit_used: customer.creditUsed,
        price_tier: customer.priceTier,
        total_purchases: customer.totalPurchases,
        last_purchase: customer.lastPurchase?.toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, customer: Partial<Customer>): Promise<Customer> {
    // Only include fields that are actually provided
    const updateData: Record<string, unknown> = {};

    if (customer.name !== undefined) updateData.name = customer.name;
    if (customer.email !== undefined) updateData.email = customer.email;
    if (customer.phone !== undefined) updateData.phone = customer.phone;
    if (customer.address !== undefined) updateData.address = customer.address;
    if (customer.creditLimit !== undefined) updateData.credit_limit = customer.creditLimit;
    if (customer.creditUsed !== undefined) updateData.credit_used = customer.creditUsed;
    if (customer.priceTier !== undefined) updateData.price_tier = customer.priceTier;
    if (customer.totalPurchases !== undefined) updateData.total_purchases = customer.totalPurchases;
    if (customer.lastPurchase !== undefined) updateData.last_purchase = customer.lastPurchase?.toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Sales Service
export const salesService = {
  async getAll(
    { limit = 50, cursor = 0 }: { limit?: number; cursor?: number } = {}
  ): Promise<{ data: Sale[]; count: number; hasMore: boolean }> {
    // Fetch total count (lightweight — only scans index)
    const { count, error: countError } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    const from = cursor
    const to = cursor + limit - 1

    // Fetch paginated rows
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const sales = data.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      customerId: sale.customer_id || undefined,
      customerName: sale.customer_name || undefined,
      items: (sale.items as CartItem[]) || [],
      subtotal: sale.subtotal || 0,
      discountAmount: sale.discount_amount || 0,
      taxAmount: sale.tax_amount || 0,
      total: sale.total || 0,
      paymentMethod: sale.payment_method as Sale['paymentMethod'],
      payments: sale.payments as Payment[] | undefined,
      cardDetails: sale.card_details as CardDetails | undefined,
      status: sale.status as Sale['status'],
      cashier: sale.cashier || '',
      timestamp: new Date(sale.created_at),
      receiptNumber: sale.receipt_number || undefined,
      notes: sale.notes || undefined,
      appliedDiscounts: sale.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: sale.free_gifts as CartItem[] | undefined,
    }))

    return {
      data: sales,
      count: count ?? 0,
      hasMore: cursor + limit < (count ?? 0)
    }
  },

  async create(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        invoice_number: sale.invoiceNumber,
        customer_id: sale.customerId,
        customer_name: sale.customerName,
        items: sale.items,
        subtotal: sale.subtotal,
        discount_amount: sale.discountAmount,
        tax_amount: sale.taxAmount,
        total: sale.total,
        payment_method: sale.paymentMethod,
        payments: sale.payments,
        card_details: sale.cardDetails,
        status: sale.status,
        cashier: sale.cashier,
        receipt_number: sale.receiptNumber,
        notes: sale.notes,
        applied_discounts: sale.appliedDiscounts,
        free_gifts: sale.freeGifts
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      customerId: data.customer_id || undefined,
      customerName: data.customer_name || undefined,
      items: (data.items as CartItem[]) || [],
      subtotal: data.subtotal || 0,
      discountAmount: data.discount_amount || 0,
      taxAmount: data.tax_amount || 0,
      total: data.total || 0,
      paymentMethod: data.payment_method as Sale['paymentMethod'],
      cardDetails: data.card_details as CardDetails | undefined,
      status: data.status as Sale['status'],
      cashier: data.cashier || '',
      timestamp: new Date(data.created_at),
      receiptNumber: data.receipt_number || undefined,
      notes: data.notes || undefined,
      appliedDiscounts: data.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: data.free_gifts as CartItem[] | undefined,
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Checkout Service — atomic checkout via RPC (VISION §11)
export const checkoutService = {
  async complete(shopId: string, saleData: Record<string, unknown>, payments: Record<string, unknown>, cashierId: string): Promise<Sale> {
    const { data: rpcResult, error } = await supabase.rpc('checkout_complete', {
      p_shop_id: shopId,
      p_sale_data: saleData,
      p_payments: payments,
      p_cashier_id: cashierId,
    })

    if (error) {
      if (error.message?.includes('DAILY_LIMIT_REACHED')) {
        throw new DailyLimitError()
      }
      throw error
    }

    // RPC returns JSONB {sale_id, invoice_number}; extract sale_id for row fetch.
    const saleId = rpcResult?.sale_id ?? rpcResult
    const { data: row, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (fetchError) throw fetchError

    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id || undefined,
      customerName: row.customer_name || undefined,
      items: (row.items as CartItem[]) || [],
      subtotal: row.subtotal || 0,
      discountAmount: row.discount_amount || 0,
      taxAmount: row.tax_amount || 0,
      total: row.total || 0,
      paymentMethod: row.payment_method as Sale['paymentMethod'],
      payments: row.payments as Payment[] | undefined,
      cardDetails: row.card_details as CardDetails | undefined,
      status: row.status as Sale['status'],
      cashier: row.cashier || '',
      cashierId: row.cashier_id || undefined,
      timestamp: new Date(row.created_at),
      receiptNumber: row.receipt_number || undefined,
      notes: row.notes || undefined,
      appliedDiscounts: row.applied_discounts as AppliedDiscount[] | undefined,
      freeGifts: row.free_gifts as CartItem[] | undefined,
    }
  },
}

// Discounts Service
export const discountsService = {
  async getAll(): Promise<Discount[]> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(discount => ({
      id: discount.id,
      name: discount.name,
      description: discount.description || '',
      type: discount.type as Discount['type'],
      value: discount.value || 0,
      conditions: (discount.conditions as DiscountCondition[]) || [],
      freeGiftProducts: discount.free_gift_products || undefined,
      minAmount: discount.min_amount || undefined,
      maxDiscount: discount.max_discount || undefined,
      validFrom: new Date(discount.valid_from),
      validTo: new Date(discount.valid_to),
      validDays: discount.valid_days || undefined,
      active: discount.active ?? true,
      createdAt: new Date(discount.created_at)
    }))
  },

  async create(discount: Omit<Discount, 'id' | 'createdAt'>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .insert({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions,
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom.toISOString(),
        valid_to: discount.validTo.toISOString(),
        valid_days: discount.validDays,
        active: discount.active
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      type: data.type as Discount['type'],
      value: data.value || 0,
      conditions: (data.conditions as DiscountCondition[]) || [],
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, discount: Partial<Discount>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .update({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions,
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom?.toISOString(),
        valid_to: discount.validTo?.toISOString(),
        valid_days: discount.validDays,
        active: discount.active
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      type: data.type as Discount['type'],
      value: data.value || 0,
      conditions: (data.conditions as DiscountCondition[]) || [],
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Settings Service
export const settingsService = {
  async get(): Promise<AppSettings> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) throw error

    return {
      storeName: data.store_name || 'CoffeeShop POS',
      storeAddress: data.store_address || '',
      storePhone: data.store_phone || '',
      storeEmail: data.store_email || '',
      storeLogo: data.store_logo || undefined,
      taxRate: data.tax_rate || 0,
      interfaceMode: (data.interface_mode as AppSettings['interfaceMode']) || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: (data.theme as AppSettings['theme']) || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
    }
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    // First, get the existing settings record to get its ID
    const { data: existingData, error: fetchError } = await supabase
      .from('app_settings')
      .select('id')
      .limit(1)
      .single()

    if (fetchError) throw fetchError

    // Update the existing record by ID
    const { data, error } = await supabase
      .from('app_settings')
      .update({
        store_name: settings.storeName,
        store_address: settings.storeAddress,
        store_phone: settings.storePhone,
        store_email: settings.storeEmail,
        store_logo: settings.storeLogo,
        tax_rate: settings.taxRate,
        interface_mode: settings.interfaceMode,
        auto_backup: settings.autoBackup,
        receipt_printer: settings.receiptPrinter,
        theme: settings.theme,
        invoice_prefix: settings.invoicePrefix,
        invoice_counter: settings.invoiceCounter,
      })
      .eq('id', existingData.id)
      .select()
      .single()

    if (error) throw error

    return {
      storeName: data.store_name || 'CoffeeShop POS',
      storeAddress: data.store_address || '',
      storePhone: data.store_phone || '',
      storeEmail: data.store_email || '',
      storeLogo: data.store_logo || undefined,
      taxRate: data.tax_rate || 0,
      interfaceMode: (data.interface_mode as AppSettings['interfaceMode']) || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: (data.theme as AppSettings['theme']) || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
    }
  }
}

// Users Service
export const usersService = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role as User['role'],
      permissions: user.permissions || [],
      active: user.active ?? true,
      lastLogin: user.last_login ? new Date(user.last_login) : undefined,
      avatar: user.avatar || undefined
    }))
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        avatar: user.avatar
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role as User['role'],
      permissions: data.permissions || [],
      active: data.active ?? true,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      avatar: data.avatar || undefined
    }
  },

  async update(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        avatar: user.avatar,
        last_login: user.lastLogin?.toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role as User['role'],
      permissions: data.permissions || [],
      active: data.active ?? true,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      avatar: data.avatar || undefined
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Sales Tabs Service
export const salesTabsService = {
  async getByUserId(userId: string): Promise<SalesTab[]> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .select(`
        *,
        selected_customer:customers(*)
      `)
      .eq('user_id', userId)
      .order('created_at')

    if (error) throw error

    return data.map(tab => ({
      id: tab.id,
      name: tab.name,
      cart: (tab.cart as CartItem[]) || [],
      selectedCustomer: tab.selected_customer ? {
        id: tab.selected_customer.id,
        name: tab.selected_customer.name,
        email: tab.selected_customer.email || '',
        phone: tab.selected_customer.phone || '',
        address: tab.selected_customer.address || '',
        creditLimit: tab.selected_customer.credit_limit || 0,
        creditUsed: tab.selected_customer.credit_used || 0,
        priceTier: tab.selected_customer.price_tier || 'Standard',
        totalPurchases: tab.selected_customer.total_purchases || 0,
        lastPurchase: tab.selected_customer.last_purchase ? new Date(tab.selected_customer.last_purchase) : undefined,
        createdAt: new Date(tab.selected_customer.created_at)
      } : null,
      createdAt: new Date(tab.created_at)
    }))
  },

  async create(userId: string, tab: Omit<SalesTab, 'id' | 'createdAt'>): Promise<SalesTab> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .insert({
        user_id: userId,
        name: tab.name,
        cart: tab.cart,
        selected_customer_id: tab.selectedCustomer?.id
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: (data.cart as CartItem[]) || [],
      selectedCustomer: tab.selectedCustomer,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, tab: Partial<SalesTab>): Promise<SalesTab> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .update({
        name: tab.name,
        cart: tab.cart,
        selected_customer_id: tab.selectedCustomer?.id
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: (data.cart as CartItem[]) || [],
      selectedCustomer: tab.selectedCustomer || null,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales_tabs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Recipients Service
export const alertRecipientsService = {
  async getAll(): Promise<AlertRecipient[]> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(recipient => ({
      id: recipient.id,
      name: recipient.name,
      email: recipient.email || undefined,
      phone: recipient.phone || undefined,
      role: recipient.role as 'admin' | 'manager' | 'cashier',
      alertTypes: recipient.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: recipient.is_active ?? true,
      createdAt: new Date(recipient.created_at),
      updatedAt: new Date(recipient.updated_at)
    }))
  },

  async create(recipient: Omit<AlertRecipient, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRecipient> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .insert({
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        role: recipient.role,
        alert_types: recipient.alertTypes,
        is_active: recipient.isActive
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role as 'admin' | 'manager' | 'cashier',
      alertTypes: data.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, recipient: Partial<AlertRecipient>): Promise<AlertRecipient> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .update({
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        role: recipient.role,
        alert_types: recipient.alertTypes,
        is_active: recipient.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role as 'admin' | 'manager' | 'cashier',
      alertTypes: data.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('alert_recipients')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Templates Service
export const alertTemplatesService = {
  async getAll(): Promise<AlertTemplate[]> {
    const { data, error } = await supabase
      .from('alert_templates')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(template => ({
      id: template.id,
      name: template.name,
      type: template.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: template.channel as 'email' | 'sms' | 'both',
      subject: template.subject || undefined,
      body: template.body,
      isActive: template.is_active ?? true,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at)
    }))
  },

  async create(template: Omit<AlertTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertTemplate> {
    const { data, error } = await supabase
      .from('alert_templates')
      .insert({
        name: template.name,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        is_active: template.isActive
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      type: data.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: data.channel as 'email' | 'sms' | 'both',
      subject: data.subject || undefined,
      body: data.body,
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, template: Partial<AlertTemplate>): Promise<AlertTemplate> {
    const { data, error } = await supabase
      .from('alert_templates')
      .update({
        name: template.name,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        is_active: template.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      type: data.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: data.channel as 'email' | 'sms' | 'both',
      subject: data.subject || undefined,
      body: data.body,
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('alert_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Configurations Service
export const alertConfigurationsService = {
  async getAll(): Promise<AlertConfiguration[]> {
    const { data, error } = await supabase
      .from('alert_configurations')
      .select('*')
      .order('alert_type')

    if (error) throw error

    return data.map(config => ({
      id: config.id,
      alertType: config.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      isEnabled: config.is_enabled ?? true,
      thresholdValue: config.threshold_value || undefined,
      checkFrequencyMinutes: config.check_frequency_minutes || 60,
      cooldownMinutes: config.cooldown_minutes || 1440,
      emailTemplateId: config.email_template_id || undefined,
      smsTemplateId: config.sms_template_id || undefined,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at)
    }))
  },

  async update(id: string, config: Partial<AlertConfiguration>): Promise<AlertConfiguration> {
    const { data, error } = await supabase
      .from('alert_configurations')
      .update({
        alert_type: config.alertType,
        is_enabled: config.isEnabled,
        threshold_value: config.thresholdValue,
        check_frequency_minutes: config.checkFrequencyMinutes,
        cooldown_minutes: config.cooldownMinutes,
        email_template_id: config.emailTemplateId,
        sms_template_id: config.smsTemplateId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      alertType: data.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      isEnabled: data.is_enabled ?? true,
      thresholdValue: data.threshold_value || undefined,
      checkFrequencyMinutes: data.check_frequency_minutes || 60,
      cooldownMinutes: data.cooldown_minutes || 1440,
      emailTemplateId: data.email_template_id || undefined,
      smsTemplateId: data.sms_template_id || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Alert History Service
export const alertHistoryService = {
  async getAll(limit: number = 100): Promise<AlertHistory[]> {
    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data.map(history => ({
      id: history.id,
      alertType: history.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      productId: history.product_id,
      productName: history.product_name,
      productSku: history.product_sku,
      currentStock: history.current_stock,
      minStock: history.min_stock,
      thresholdValue: history.threshold_value || undefined,
      recipientId: history.recipient_id,
      recipientName: history.recipient_name,
      recipientEmail: history.recipient_email || undefined,
      recipientPhone: history.recipient_phone || undefined,
      channel: history.channel as 'email' | 'sms',
      status: history.status as 'pending' | 'sent' | 'failed' | 'delivered',
      templateId: history.template_id || undefined,
      messageContent: history.message_content || undefined,
      errorMessage: history.error_message || undefined,
      sentAt: history.sent_at ? new Date(history.sent_at) : undefined,
      deliveredAt: history.delivered_at ? new Date(history.delivered_at) : undefined,
      createdAt: new Date(history.created_at)
    }))
  },

  async getByProduct(productId: string): Promise<AlertHistory[]> {
    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map(history => ({
      id: history.id,
      alertType: history.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      productId: history.product_id,
      productName: history.product_name,
      productSku: history.product_sku,
      currentStock: history.current_stock,
      minStock: history.min_stock,
      thresholdValue: history.threshold_value || undefined,
      recipientId: history.recipient_id,
      recipientName: history.recipient_name,
      recipientEmail: history.recipient_email || undefined,
      recipientPhone: history.recipient_phone || undefined,
      channel: history.channel as 'email' | 'sms',
      status: history.status as 'pending' | 'sent' | 'failed' | 'delivered',
      templateId: history.template_id || undefined,
      messageContent: history.message_content || undefined,
      errorMessage: history.error_message || undefined,
      sentAt: history.sent_at ? new Date(history.sent_at) : undefined,
      deliveredAt: history.delivered_at ? new Date(history.delivered_at) : undefined,
      createdAt: new Date(history.created_at)
    }))
  }
}

// Notification Service Config Service
export const notificationServiceConfigService = {
  async getAll(): Promise<NotificationServiceConfig[]> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .select('*')
      .order('service_name')

    if (error) throw error

    return data.map(config => ({
      id: config.id,
      serviceName: config.service_name,
      serviceType: config.service_type as 'email' | 'sms' | 'both',
      configData: config.config_data,
      isActive: config.is_active ?? true,
      isDefault: config.is_default ?? false,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at)
    }))
  },

  async create(config: Omit<NotificationServiceConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationServiceConfig> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .insert({
        service_name: config.serviceName,
        service_type: config.serviceType,
        config_data: config.configData,
        is_active: config.isActive,
        is_default: config.isDefault
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      serviceName: data.service_name,
      serviceType: data.service_type as 'email' | 'sms' | 'both',
      configData: data.config_data,
      isActive: data.is_active ?? true,
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, config: Partial<NotificationServiceConfig>): Promise<NotificationServiceConfig> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .update({
        service_name: config.serviceName,
        service_type: config.serviceType,
        config_data: config.configData,
        is_active: config.isActive,
        is_default: config.isDefault,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      serviceName: data.service_name,
      serviceType: data.service_type as 'email' | 'sms' | 'both',
      configData: data.config_data,
      isActive: data.is_active ?? true,
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notification_service_config')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Shop Memberships Service
// Thin wrapper — resolves user's active shop via shop_memberships → shops join
export const shopMembershipsService = {
  async getShopByUserId(userId: string): Promise<Shop | null> {
    const { data, error } = await supabase
      .from('shop_memberships')
      .select('shop:shops(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error) {
      // PGRST116 = no rows found — graceful null
      if (error.code === 'PGRST116') return null
      throw error
    }

    const shop = (data as { shop: Record<string, unknown> }).shop
    if (!shop) return null

    return mapShopRow(shop)
  },
}

// Shops Service
export const shopsService = {
  async getById(id: string): Promise<Shop> {
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return mapShopRow(data)
  },

  async getByUserId(userId: string): Promise<Shop | null> {
    return shopMembershipsService.getShopByUserId(userId)
  },

  async getShopWithCapabilities(userId: string): Promise<CapabilityResolution | null> {
    const shop = await shopMembershipsService.getShopByUserId(userId)
    if (!shop) return null

    const [features, overrides, capabilities] = await Promise.all([
      featureDefinitionsService.getAll(),
      shopFeaturesService.getByShopId(shop.id),
      resolveCapabilitiesRpc(shop.id),
    ])

    return { capabilities, shop, features, overrides }
  },
}

// Feature Definitions Service
export const featureDefinitionsService = {
  async getAll(): Promise<FeatureDefinition[]> {
    const { data, error } = await supabase
      .from('feature_definitions')
      .select('*')
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      key: row.key as string,
      name: row.name as string,
      description: row.description as string,
      category: row.category as string,
      defaultEnabled: row.default_enabled as boolean,
      subscriptionTier: row.subscription_tier as string,
      createdAt: new Date(row.created_at as string),
    }))
  },
}

// Shop Features Service
export const shopFeaturesService = {
  async getByShopId(shopId: string): Promise<ShopFeature[]> {
    const { data, error } = await supabase
      .from('shop_features')
      .select('*')
      .eq('shop_id', shopId)
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      featureKey: row.feature_key as string,
      enabled: row.enabled as boolean,
      updatedAt: new Date(row.updated_at as string),
    }))
  },

  async setFeature(shopId: string, featureKey: string, enabled: boolean): Promise<ShopFeature> {
    const { data, error } = await supabase
      .from('shop_features')
      .upsert(
        { shop_id: shopId, feature_key: featureKey, enabled },
        { onConflict: 'shop_id,feature_key' }
      )
      .select()
      .single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      featureKey: data.feature_key,
      enabled: data.enabled,
      updatedAt: new Date(data.updated_at),
    }
  },

  async deleteFeature(shopId: string, featureKey: string): Promise<void> {
    const { error } = await supabase
      .from('shop_features')
      .delete()
      .eq('shop_id', shopId)
      .eq('feature_key', featureKey)
    if (error) throw error
  },
}

// ================================================================
// Print Jobs Service
// ================================================================

// Print Jobs Service (kept — used by checkoutService for Growth+ tier receipt printing)
export const printJobsService = {
  async getAll(filters?: { status?: PrintJobStatus }): Promise<PrintJob[]> {
    let query = supabase.from('print_jobs').select('*')
    if (filters?.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      orderId: row.order_id as string,
      status: row.status as PrintJobStatus,
      configData: (row.config_data as Record<string, string | number | boolean>) || {},
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    }))
  },

  async getById(id: string): Promise<PrintJob> {
    const { data, error } = await supabase.from('print_jobs').select('*').eq('id', id).single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async enqueue(input: { shopId: string; orderId: string; configData: Record<string, string | number | boolean> }): Promise<PrintJob> {
    const { data, error } = await supabase.from('print_jobs').insert({
      shop_id: input.shopId,
      order_id: input.orderId,
      status: 'pending',
      config_data: input.configData,
    }).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async updateStatus(id: string, status: PrintJobStatus): Promise<PrintJob> {
    const updateData: Record<string, unknown> = { status }
    if (status === 'completed' || status === 'failed') updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabase.from('print_jobs').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      orderId: data.order_id,
      status: data.status as PrintJobStatus,
      configData: data.config_data || {},
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('print_jobs').delete().eq('id', id)
    if (error) throw error
  },
}

// ================================================================
// Cash Shifts Service (VISION §12)
// ================================================================

export const cashShiftsService = {
  async getOpenByCashier(cashierId: string): Promise<CashShift | null> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      closingCash: data.closing_cash != null ? Number(data.closing_cash) : undefined,
      expectedCash: data.expected_cash != null ? Number(data.expected_cash) : undefined,
      variance: data.variance != null ? Number(data.variance) : undefined,
      status: data.status as 'open' | 'closed',
      openedAt: new Date(data.opened_at),
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    }
  },

  async create(input: { shopId: string; cashierId: string; openingCash: number }): Promise<CashShift> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .insert({
        shop_id: input.shopId,
        cashier_id: input.cashierId,
        opening_cash: input.openingCash,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      status: 'open',
      openedAt: new Date(data.opened_at),
    }
  },

  async close(id: string, closingCash: number, expectedCash?: number): Promise<CashShift> {
    const variance = expectedCash != null ? closingCash - expectedCash : undefined

    const { data, error } = await supabase
      .from('cash_shifts')
      .update({
        closing_cash: closingCash,
        expected_cash: expectedCash,
        variance,
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      shopId: data.shop_id,
      cashierId: data.cashier_id,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      expectedCash: data.expected_cash != null ? Number(data.expected_cash) : undefined,
      variance: data.variance != null ? Number(data.variance) : undefined,
      status: 'closed',
      openedAt: new Date(data.opened_at),
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
    }
  },

  async getByShopId(shopId: string, limit = 10): Promise<CashShift[]> {
    const { data, error } = await supabase
      .from('cash_shifts')
      .select('*')
      .eq('shop_id', shopId)
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      shopId: row.shop_id as string,
      cashierId: row.cashier_id as string,
      openingCash: Number(row.opening_cash),
      closingCash: row.closing_cash != null ? Number(row.closing_cash) : undefined,
      expectedCash: row.expected_cash != null ? Number(row.expected_cash) : undefined,
      variance: row.variance != null ? Number(row.variance) : undefined,
      status: row.status as 'open' | 'closed',
      openedAt: new Date(row.opened_at as string),
      closedAt: row.closed_at ? new Date(row.closed_at as string) : undefined,
    }))
  },
}

// ================================================================
// Platform Admin Service
// All methods use supabase.functions.invoke() — NEVER supabase.from()
// VISION.md §17.4: Platform admin operations MUST use Edge Functions.
// ================================================================

export interface PlatformShop {
  id: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  businessType?: string;
  subscriptionTier: string;
  isActive: boolean;
  dailyOrderLimit?: number;
  ownerId?: string;
  createdAt: string;
  updatedAt?: string;
  membershipActive?: boolean;
  membershipRole?: string;
}

export interface PlatformShopDetail {
  shop: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  users: Record<string, unknown>[];
  stats: { salesCount: number; totalRevenue: number };
}

export interface PlatformDailyStats {
  totalShops: number;
  activeShops: number;
  pendingApprovals: number;
  mrr: number;
}

export const platformAdminService = {
  async approveShop(shopId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-approve-shop', {
      body: { shop_id: shopId },
    })
    if (error) throw error
  },

  async rejectShop(shopId: string, reason: string): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-reject-shop', {
      body: { shop_id: shopId, reason },
    })
    if (error) throw error
  },

  async updateSubscription(shopId: string, tier: 'free' | 'growth' | 'pro'): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-update-subscription', {
      body: { shop_id: shopId, tier },
    })
    if (error) throw error
  },

  async listShops(filters?: { status?: string; tier?: string }): Promise<PlatformShop[]> {
    const { data, error } = await supabase.functions.invoke('platform-admin-list-shops', {
      body: filters ?? {},
    })
    if (error) throw error
    return (data?.shops ?? []) as PlatformShop[]
  },

  async getShopDetail(shopId: string): Promise<PlatformShopDetail> {
    const { data, error } = await supabase.functions.invoke('platform-admin-get-shop-detail', {
      body: { shop_id: shopId },
    })
    if (error) throw error
    return data as PlatformShopDetail
  },

  async manageFeatures(
    action: 'list' | 'create' | 'update' | 'delete',
    payload?: Record<string, unknown>,
  ): Promise<{ features?: Record<string, unknown>[]; feature?: Record<string, unknown>; message?: string }> {
    const { data, error } = await supabase.functions.invoke('platform-admin-manage-features', {
      body: { action, ...(payload ?? {}) },
    })
    if (error) throw error
    return data ?? {}
  },

  async dailyStats(): Promise<PlatformDailyStats> {
    const { data, error } = await supabase.functions.invoke('platform-admin-daily-stats')
    if (error) throw error
    return data?.stats as PlatformDailyStats
  },

  async toggleShopActive(shopId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.functions.invoke('platform-admin-update-subscription', {
      body: { shop_id: shopId, is_active: isActive },
    })
    if (error) throw error
  },
}
