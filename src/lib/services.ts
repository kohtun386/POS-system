import { supabase } from './supabase'
import {
  Product,
  ProductBatch,
  Customer,
  Sale,
  Discount,
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
  RawMaterial,
  Recipe,
  RecipeLine,
  ConsumptionLog,
  UomConversion,
  KitchenOrder,
  KitchenOrderItem,
  KitchenOrderItemsPayload,
  KitchenOrderStatus,
  KitchenStation,
  PrintJob,
  PrintJobStatus
} from '../types'

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

    return data.map((batch: any) => ({
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
      batches: data.product_batches?.map((batch: any) => ({
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
    const updateData: any = {};

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
      items: sale.items as any[],
      subtotal: sale.subtotal || 0,
      discountAmount: sale.discount_amount || 0,
      taxAmount: sale.tax_amount || 0,
      total: sale.total || 0,
      paymentMethod: sale.payment_method as any,
      payments: sale.payments as any,
      cardDetails: sale.card_details as any,
      status: sale.status as any,
      cashier: sale.cashier || '',
      timestamp: new Date(sale.created_at),
      receiptNumber: sale.receipt_number || undefined,
      notes: sale.notes || undefined,
      appliedDiscounts: sale.applied_discounts as any,
      freeGifts: sale.free_gifts as any
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
      items: data.items as any[],
      subtotal: data.subtotal || 0,
      discountAmount: data.discount_amount || 0,
      taxAmount: data.tax_amount || 0,
      total: data.total || 0,
      paymentMethod: data.payment_method as any,
      cardDetails: data.card_details as any,
      status: data.status as any,
      cashier: data.cashier || '',
      timestamp: new Date(data.created_at),
      receiptNumber: data.receipt_number || undefined,
      notes: data.notes || undefined,
      appliedDiscounts: data.applied_discounts as any,
      freeGifts: data.free_gifts as any
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
      type: discount.type as any,
      value: discount.value || 0,
      conditions: discount.conditions as any,
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
      type: data.type as any,
      value: data.value || 0,
      conditions: data.conditions as any,
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
      type: data.type as any,
      value: data.value || 0,
      conditions: data.conditions as any,
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
      currency: data.currency || 'USD',
      baseCurrency: data.base_currency || 'USD',
      interfaceMode: data.interface_mode as any || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: data.theme as any || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
      exchangeRateProvider: data.exchange_rate_provider as any || 'exchangerate',
      exchangeRateApiKey: data.exchange_rate_api_key || undefined,
      exchangeRateUpdateInterval: data.exchange_rate_update_interval || 60
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
        currency: settings.currency,
        base_currency: settings.baseCurrency,
        interface_mode: settings.interfaceMode,
        auto_backup: settings.autoBackup,
        receipt_printer: settings.receiptPrinter,
        theme: settings.theme,
        invoice_prefix: settings.invoicePrefix,
        invoice_counter: settings.invoiceCounter,
        exchange_rate_provider: settings.exchangeRateProvider,
        exchange_rate_api_key: settings.exchangeRateApiKey,
        exchange_rate_update_interval: settings.exchangeRateUpdateInterval
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
      currency: data.currency || 'USD',
      baseCurrency: data.base_currency || 'USD',
      interfaceMode: data.interface_mode as any || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: data.theme as any || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
      exchangeRateProvider: data.exchange_rate_provider as any || 'exchangerate',
      exchangeRateApiKey: data.exchange_rate_api_key || undefined,
      exchangeRateUpdateInterval: data.exchange_rate_update_interval || 60
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
      role: user.role as any,
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
      role: data.role as any,
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
      role: data.role as any,
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
      cart: tab.cart as any[] || [],
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
      cart: data.cart as any[] || [],
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
      cart: data.cart as any[] || [],
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

    const shop = (data as any).shop
    if (!shop) return null

    return {
      id: shop.id,
      name: shop.name || '',
      address: shop.address || '',
      phone: shop.phone || '',
      email: shop.email || '',
      createdAt: new Date(shop.created_at),
      updatedAt: new Date(shop.updated_at),
    }
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

    return {
      id: data.id,
      name: data.name || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async getByUserId(userId: string): Promise<Shop | null> {
    return shopMembershipsService.getShopByUserId(userId)
  },
}

// Feature Definitions Service
export const featureDefinitionsService = {
  async getAll(): Promise<FeatureDefinition[]> {
    const { data, error } = await supabase
      .from('feature_definitions')
      .select('*')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      defaultEnabled: row.default_enabled,
      subscriptionTier: row.subscription_tier,
      createdAt: new Date(row.created_at),
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
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      featureKey: row.feature_key,
      enabled: row.enabled,
      updatedAt: new Date(row.updated_at),
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
// Recipe BOM Services
// ================================================================

// Raw Materials Service
export const rawMaterialsService = {
  async getAll(filters?: { category?: string; active?: boolean }): Promise<RawMaterial[]> {
    let query = supabase.from('raw_materials').select('*')
    if (filters?.category) query = query.eq('category', filters.category)
    if (filters?.active !== undefined) query = query.eq('is_active', filters.active)
    const { data, error } = await query.order('name')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      currentStock: Number(row.current_stock),
      minimumStock: Number(row.minimum_stock),
      baseUnit: row.base_unit,
      costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : undefined,
      isActive: row.is_active,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  },

  async getById(id: string): Promise<RawMaterial> {
    const { data, error } = await supabase.from('raw_materials').select('*').eq('id', id).single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      currentStock: Number(data.current_stock),
      minimumStock: Number(data.minimum_stock),
      baseUnit: data.base_unit,
      costPerUnit: data.cost_per_unit ? Number(data.cost_per_unit) : undefined,
      isActive: data.is_active,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async create(input: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>): Promise<RawMaterial> {
    const { data, error } = await supabase.from('raw_materials').insert({
      shop_id: input.shopId,
      name: input.name,
      sku: input.sku,
      category: input.category,
      current_stock: input.currentStock,
      minimum_stock: input.minimumStock,
      base_unit: input.baseUnit,
      cost_per_unit: input.costPerUnit,
      is_active: input.isActive,
      notes: input.notes,
    }).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      currentStock: Number(data.current_stock),
      minimumStock: Number(data.minimum_stock),
      baseUnit: data.base_unit,
      costPerUnit: data.cost_per_unit ? Number(data.cost_per_unit) : undefined,
      isActive: data.is_active,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async update(id: string, input: Partial<RawMaterial>): Promise<RawMaterial> {
    const updateData: any = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.sku !== undefined) updateData.sku = input.sku
    if (input.category !== undefined) updateData.category = input.category
    if (input.currentStock !== undefined) updateData.current_stock = input.currentStock
    if (input.minimumStock !== undefined) updateData.minimum_stock = input.minimumStock
    if (input.baseUnit !== undefined) updateData.base_unit = input.baseUnit
    if (input.costPerUnit !== undefined) updateData.cost_per_unit = input.costPerUnit
    if (input.isActive !== undefined) updateData.is_active = input.isActive
    if (input.notes !== undefined) updateData.notes = input.notes
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from('raw_materials').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      currentStock: Number(data.current_stock),
      minimumStock: Number(data.minimum_stock),
      baseUnit: data.base_unit,
      costPerUnit: data.cost_per_unit ? Number(data.cost_per_unit) : undefined,
      isActive: data.is_active,
      notes: data.notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('raw_materials').delete().eq('id', id)
    if (error) throw error
  },

  async restock(id: string, quantity: number, unit?: string): Promise<RawMaterial> {
    const material = await this.getById(id)
    let addQuantity = quantity
    if (unit && unit !== material.baseUnit) {
      // Convert to base unit using UoM conversions
      const { data: conv } = await supabase
        .from('uom_conversions')
        .select('factor')
        .eq('from_unit', unit)
        .eq('to_unit', material.baseUnit)
        .single()
      if (conv) addQuantity = quantity * Number(conv.factor)
    }
    return this.update(id, { currentStock: material.currentStock + addQuantity })
  },

  async getLowStock(): Promise<RawMaterial[]> {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .eq('is_active', true)
      .filter('current_stock', 'lte', 'minimum_stock')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      sku: row.sku,
      category: row.category,
      currentStock: Number(row.current_stock),
      minimumStock: Number(row.minimum_stock),
      baseUnit: row.base_unit,
      costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : undefined,
      isActive: row.is_active,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  },
}

// Recipes Service
export const recipesService = {
  async getAll(): Promise<Recipe[]> {
    const { data, error } = await supabase.from('recipes').select('*').order('product_name')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      productId: row.product_id,
      productName: row.product_name,
      servingSize: Number(row.serving_size),
      servingUnit: row.serving_unit,
      prepTimeSeconds: row.prep_time_seconds,
      instructions: row.instructions,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }))
  },

  async getByProductId(productId: string): Promise<Recipe | null> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: data.id,
      shopId: data.shop_id,
      productId: data.product_id,
      productName: data.product_name,
      servingSize: Number(data.serving_size),
      servingUnit: data.serving_unit,
      prepTimeSeconds: data.prep_time_seconds,
      instructions: data.instructions,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async create(input: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> {
    const { data, error } = await supabase.from('recipes').insert({
      shop_id: input.shopId,
      product_id: input.productId,
      product_name: input.productName,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit,
      prep_time_seconds: input.prepTimeSeconds,
      instructions: input.instructions,
      is_active: input.isActive,
    }).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      productId: data.product_id,
      productName: data.product_name,
      servingSize: Number(data.serving_size),
      servingUnit: data.serving_unit,
      prepTimeSeconds: data.prep_time_seconds,
      instructions: data.instructions,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async update(id: string, input: Partial<Recipe>): Promise<Recipe> {
    const updateData: any = {}
    if (input.productId !== undefined) updateData.product_id = input.productId
    if (input.productName !== undefined) updateData.product_name = input.productName
    if (input.servingSize !== undefined) updateData.serving_size = input.servingSize
    if (input.servingUnit !== undefined) updateData.serving_unit = input.servingUnit
    if (input.prepTimeSeconds !== undefined) updateData.prep_time_seconds = input.prepTimeSeconds
    if (input.instructions !== undefined) updateData.instructions = input.instructions
    if (input.isActive !== undefined) updateData.is_active = input.isActive
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from('recipes').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      productId: data.product_id,
      productName: data.product_name,
      servingSize: Number(data.serving_size),
      servingUnit: data.serving_unit,
      prepTimeSeconds: data.prep_time_seconds,
      instructions: data.instructions,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) throw error
  },

  async duplicate(recipeId: string, newProductId: string): Promise<Recipe> {
    const original = await supabase.from('recipes').select('*').eq('id', recipeId).single()
    if (original.error) throw original.error

    const { data: newRecipe, error } = await supabase.from('recipes').insert({
      shop_id: original.data.shop_id,
      product_id: newProductId,
      product_name: original.data.product_name,
      serving_size: original.data.serving_size,
      serving_unit: original.data.serving_unit,
      prep_time_seconds: original.data.prep_time_seconds,
      instructions: original.data.instructions,
      is_active: original.data.is_active,
    }).select().single()
    if (error) throw error

    // Copy recipe lines
    const { data: lines } = await supabase.from('recipe_lines').select('*').eq('recipe_id', recipeId)
    if (lines && lines.length > 0) {
      await supabase.from('recipe_lines').insert(
        lines.map((line: any) => ({
          shop_id: line.shop_id,
          recipe_id: newRecipe.id,
          raw_material_id: line.raw_material_id,
          raw_material_name: line.raw_material_name,
          quantity: line.quantity,
          recipe_unit: line.recipe_unit,
          recipe_quantity: line.recipe_quantity,
          wastage_percent: line.wastage_percent,
          is_optional: line.is_optional,
          notes: line.notes,
        }))
      )
    }

    return {
      id: newRecipe.id,
      shopId: newRecipe.shop_id,
      productId: newRecipe.product_id,
      productName: newRecipe.product_name,
      servingSize: Number(newRecipe.serving_size),
      servingUnit: newRecipe.serving_unit,
      prepTimeSeconds: newRecipe.prep_time_seconds,
      instructions: newRecipe.instructions,
      isActive: newRecipe.is_active,
      createdAt: new Date(newRecipe.created_at),
      updatedAt: new Date(newRecipe.updated_at),
    }
  },
}

// Recipe Lines Service
export const recipeLinesService = {
  async getByRecipeId(recipeId: string): Promise<RecipeLine[]> {
    const { data, error } = await supabase
      .from('recipe_lines')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('raw_material_name')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      recipeId: row.recipe_id,
      rawMaterialId: row.raw_material_id,
      rawMaterialName: row.raw_material_name,
      quantity: Number(row.quantity),
      recipeUnit: row.recipe_unit,
      recipeQuantity: row.recipe_quantity ? Number(row.recipe_quantity) : undefined,
      wastagePercent: Number(row.wastage_percent),
      isOptional: row.is_optional,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    }))
  },

  async create(input: Omit<RecipeLine, 'id' | 'createdAt'>): Promise<RecipeLine> {
    const { data, error } = await supabase.from('recipe_lines').insert({
      shop_id: input.shopId,
      recipe_id: input.recipeId,
      raw_material_id: input.rawMaterialId,
      raw_material_name: input.rawMaterialName,
      quantity: input.quantity,
      recipe_unit: input.recipeUnit,
      recipe_quantity: input.recipeQuantity,
      wastage_percent: input.wastagePercent,
      is_optional: input.isOptional,
      notes: input.notes,
    }).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      recipeId: data.recipe_id,
      rawMaterialId: data.raw_material_id,
      rawMaterialName: data.raw_material_name,
      quantity: Number(data.quantity),
      recipeUnit: data.recipe_unit,
      recipeQuantity: data.recipe_quantity ? Number(data.recipe_quantity) : undefined,
      wastagePercent: Number(data.wastage_percent),
      isOptional: data.is_optional,
      notes: data.notes,
      createdAt: new Date(data.created_at),
    }
  },

  async update(id: string, input: Partial<RecipeLine>): Promise<RecipeLine> {
    const updateData: any = {}
    if (input.rawMaterialId !== undefined) updateData.raw_material_id = input.rawMaterialId
    if (input.rawMaterialName !== undefined) updateData.raw_material_name = input.rawMaterialName
    if (input.quantity !== undefined) updateData.quantity = input.quantity
    if (input.recipeUnit !== undefined) updateData.recipe_unit = input.recipeUnit
    if (input.recipeQuantity !== undefined) updateData.recipe_quantity = input.recipeQuantity
    if (input.wastagePercent !== undefined) updateData.wastage_percent = input.wastagePercent
    if (input.isOptional !== undefined) updateData.is_optional = input.isOptional
    if (input.notes !== undefined) updateData.notes = input.notes

    const { data, error } = await supabase.from('recipe_lines').update(updateData).eq('id', id).select().single()
    if (error) throw error
    return {
      id: data.id,
      shopId: data.shop_id,
      recipeId: data.recipe_id,
      rawMaterialId: data.raw_material_id,
      rawMaterialName: data.raw_material_name,
      quantity: Number(data.quantity),
      recipeUnit: data.recipe_unit,
      recipeQuantity: data.recipe_quantity ? Number(data.recipe_quantity) : undefined,
      wastagePercent: Number(data.wastage_percent),
      isOptional: data.is_optional,
      notes: data.notes,
      createdAt: new Date(data.created_at),
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('recipe_lines').delete().eq('id', id)
    if (error) throw error
  },

  async bulkReplace(recipeId: string, lines: Omit<RecipeLine, 'id' | 'createdAt'>[]): Promise<RecipeLine[]> {
    // Delete existing lines
    await supabase.from('recipe_lines').delete().eq('recipe_id', recipeId)

    // Insert new lines
    if (lines.length === 0) return []
    const { data, error } = await supabase.from('recipe_lines').insert(
      lines.map(line => ({
        shop_id: line.shopId,
        recipe_id: line.recipeId,
        raw_material_id: line.rawMaterialId,
        raw_material_name: line.rawMaterialName,
        quantity: line.quantity,
        recipe_unit: line.recipeUnit,
        recipe_quantity: line.recipeQuantity,
        wastage_percent: line.wastagePercent,
        is_optional: line.isOptional,
        notes: line.notes,
      }))
    ).select()
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      recipeId: row.recipe_id,
      rawMaterialId: row.raw_material_id,
      rawMaterialName: row.raw_material_name,
      quantity: Number(row.quantity),
      recipeUnit: row.recipe_unit,
      recipeQuantity: row.recipe_quantity ? Number(row.recipe_quantity) : undefined,
      wastagePercent: Number(row.wastage_percent),
      isOptional: row.is_optional,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    }))
  },
}

// Consumption Log Service (read-only — trigger writes, never updated)
export const consumptionLogService = {
  async getBySaleId(saleId: string): Promise<ConsumptionLog[]> {
    const { data, error } = await supabase
      .from('consumption_log')
      .select('*')
      .eq('sale_id', saleId)
      .order('consumed_at')
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      saleId: row.sale_id,
      saleItemIndex: row.sale_item_index,
      productId: row.product_id,
      productName: row.product_name,
      rawMaterialId: row.raw_material_id,
      rawMaterialName: row.raw_material_name,
      quantityConsumed: Number(row.quantity_consumed),
      quantityBase: Number(row.quantity_base),
      wastageAmount: Number(row.wastage_amount),
      unit: row.unit,
      stockBefore: Number(row.stock_before),
      stockAfter: Number(row.stock_after),
      consumedAt: new Date(row.consumed_at),
    }))
  },

  async getByMaterialId(materialId: string, period?: { from: Date; to: Date }): Promise<ConsumptionLog[]> {
    let query = supabase
      .from('consumption_log')
      .select('*')
      .eq('raw_material_id', materialId)
    if (period) {
      query = query.gte('consumed_at', period.from.toISOString()).lte('consumed_at', period.to.toISOString())
    }
    const { data, error } = await query.order('consumed_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      saleId: row.sale_id,
      saleItemIndex: row.sale_item_index,
      productId: row.product_id,
      productName: row.product_name,
      rawMaterialId: row.raw_material_id,
      rawMaterialName: row.raw_material_name,
      quantityConsumed: Number(row.quantity_consumed),
      quantityBase: Number(row.quantity_base),
      wastageAmount: Number(row.wastage_amount),
      unit: row.unit,
      stockBefore: Number(row.stock_before),
      stockAfter: Number(row.stock_after),
      consumedAt: new Date(row.consumed_at),
    }))
  },

  async getSummary(period?: { from: Date; to: Date }): Promise<{
    totalCost: number;
    byMaterial: Array<{ materialId: string; materialName: string; totalConsumed: number; unit: string }>;
    byProduct: Array<{ productId: string; productName: string; totalCost: number }>;
    totalWastage: number;
  }> {
    let query = supabase.from('consumption_log').select('*')
    if (period) {
      query = query.gte('consumed_at', period.from.toISOString()).lte('consumed_at', period.to.toISOString())
    }
    const { data, error } = await query
    if (error) throw error

    const logs = data || []
    const byMaterialMap = new Map<string, { materialId: string; materialName: string; totalConsumed: number; unit: string }>()
    const byProductMap = new Map<string, { productId: string; productName: string; totalCost: number }>()
    let totalWastage = 0

    for (const row of logs) {
      const materialId = row.raw_material_id
      const existing = byMaterialMap.get(materialId)
      if (existing) {
        existing.totalConsumed += Number(row.quantity_consumed)
      } else {
        byMaterialMap.set(materialId, {
          materialId,
          materialName: row.raw_material_name,
          totalConsumed: Number(row.quantity_consumed),
          unit: row.unit,
        })
      }

      const productId = row.product_id
      const productExisting = byProductMap.get(productId)
      if (!productExisting) {
        byProductMap.set(productId, {
          productId,
          productName: row.product_name,
          totalCost: 0,
        })
      }

      totalWastage += Number(row.wastage_amount)
    }

    return {
      totalCost: 0, // Would need cost_per_unit join
      byMaterial: Array.from(byMaterialMap.values()),
      byProduct: Array.from(byProductMap.values()),
      totalWastage,
    }
  },
}

// ================================================================
// Kitchen KDS Services
// ================================================================

/** Pack saleId + station into items JSONB, strip lineItems from top-level items */
function packKitchenItems(items: KitchenOrderItem[], saleId?: string, station?: KitchenStation): KitchenOrderItemsPayload {
  return { saleId, station, lineItems: items }
}

/** Unpack JSONB payload back to KitchenOrder fields */
function unpackKitchenItems(payload: any): { items: KitchenOrderItem[]; saleId?: string; station?: KitchenStation } {
  if (payload && typeof payload === 'object' && 'lineItems' in payload) {
    return {
      items: payload.lineItems as KitchenOrderItem[],
      saleId: payload.saleId,
      station: payload.station,
    }
  }
  // Fallback for raw array (backwards compat)
  return { items: (payload as KitchenOrderItem[]) || [] }
}

// Kitchen Orders Service
export const kitchenOrdersService = {
  async getAll(filters?: { status?: KitchenOrderStatus; station?: KitchenStation }): Promise<KitchenOrder[]> {
    let query = supabase.from('kitchen_orders').select('*')
    if (filters?.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    return (data || []).map((row: any) => {
      const unpacked = unpackKitchenItems(row.items)
      return {
        id: row.id,
        shopId: row.shop_id,
        saleId: unpacked.saleId,
        station: unpacked.station,
        items: unpacked.items,
        status: row.status as KitchenOrderStatus,
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at) : undefined,
        createdAt: new Date(row.created_at),
      }
    }).filter(o => !filters?.station || o.station === filters.station)
  },

  async getById(id: string): Promise<KitchenOrder> {
    const { data, error } = await supabase.from('kitchen_orders').select('*').eq('id', id).single()
    if (error) throw error
    const unpacked = unpackKitchenItems(data.items)
    return {
      id: data.id,
      shopId: data.shop_id,
      saleId: unpacked.saleId,
      station: unpacked.station,
      items: unpacked.items,
      status: data.status as KitchenOrderStatus,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
      createdAt: new Date(data.created_at),
    }
  },

  async create(input: { shopId: string; items: KitchenOrderItem[]; saleId?: string; station?: KitchenStation }): Promise<KitchenOrder> {
    const packed = packKitchenItems(input.items, input.saleId, input.station)
    const { data, error } = await supabase.from('kitchen_orders').insert({
      shop_id: input.shopId,
      items: packed,
      status: 'pending',
    }).select().single()
    if (error) throw error
    const unpacked = unpackKitchenItems(data.items)
    return {
      id: data.id,
      shopId: data.shop_id,
      saleId: unpacked.saleId,
      station: unpacked.station,
      items: unpacked.items,
      status: data.status as KitchenOrderStatus,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
      createdAt: new Date(data.created_at),
    }
  },

  async updateStatus(id: string, status: KitchenOrderStatus): Promise<KitchenOrder> {
    const updateData: any = { status }
    const now = new Date().toISOString()
    if (status === 'in_progress') updateData.started_at = now
    if (status === 'ready') updateData.completed_at = now
    if (status === 'picked_up') updateData.picked_up_at = now

    const { data, error } = await supabase.from('kitchen_orders').update(updateData).eq('id', id).select().single()
    if (error) throw error
    const unpacked = unpackKitchenItems(data.items)
    return {
      id: data.id,
      shopId: data.shop_id,
      saleId: unpacked.saleId,
      station: unpacked.station,
      items: unpacked.items,
      status: data.status as KitchenOrderStatus,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
      createdAt: new Date(data.created_at),
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('kitchen_orders').delete().eq('id', id)
    if (error) throw error
  },
}

// Print Jobs Service
export const printJobsService = {
  async getAll(filters?: { status?: PrintJobStatus }): Promise<PrintJob[]> {
    let query = supabase.from('print_jobs').select('*')
    if (filters?.status) query = query.eq('status', filters.status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: row.id,
      shopId: row.shop_id,
      orderId: row.order_id,
      status: row.status as PrintJobStatus,
      configData: row.config_data || {},
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
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

  async enqueue(input: { shopId: string; orderId: string; configData: Record<string, any> }): Promise<PrintJob> {
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
    const updateData: any = { status }
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
