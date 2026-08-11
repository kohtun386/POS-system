import { supabase } from '../supabase'
import type { AppSettings } from '../../types'

export const settingsService = {
  async get(shopId?: string): Promise<AppSettings> {
    let query = supabase
      .from('app_settings')
      .select('*')
      .limit(1)

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error

    if (!data) {
      return {
        storeName: 'CoffeeShop POS',
        storeAddress: '',
        storePhone: '',
        storeEmail: '',
        storeLogo: undefined,
        taxRate: 0,
        interfaceMode: 'touch',
        autoBackup: true,
        receiptPrinter: true,
        theme: 'light',
        invoicePrefix: 'INV',
        invoiceCounter: 1000,
        notificationChannel: 'none',
        whatsappRecipientPhone: '',
        discordWebhookUrl: '',
        whatsappReportTime: '18:00',
      }
    }

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
      notificationChannel: (data.notification_channel as AppSettings['notificationChannel']) || 'none',
      whatsappRecipientPhone: data.whatsapp_recipient_phone || '',
      discordWebhookUrl: data.discord_webhook_url || '',
      whatsappReportTime: data.whatsapp_report_time || '18:00',
    }
  },

  async update(settings: Partial<AppSettings>, shopId?: string): Promise<AppSettings> {
    let fetchQuery = supabase
      .from('app_settings')
      .select('id')
      .limit(1)

    if (shopId) {
      fetchQuery = fetchQuery.eq('shop_id', shopId)
    }

    const { data: existingData, error: fetchError } = await fetchQuery.maybeSingle()

    if (fetchError) throw fetchError
    if (!existingData) throw new Error('Settings not found for this shop. The auto-create trigger may not have fired.')

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
        notification_channel: settings.notificationChannel,
        whatsapp_recipient_phone: settings.whatsappRecipientPhone,
        discord_webhook_url: settings.discordWebhookUrl,
        whatsapp_report_time: settings.whatsappReportTime,
        updated_at: new Date().toISOString()
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
      notificationChannel: (data.notification_channel as AppSettings['notificationChannel']) || 'none',
      whatsappRecipientPhone: data.whatsapp_recipient_phone || '',
      discordWebhookUrl: data.discord_webhook_url || '',
      whatsappReportTime: data.whatsapp_report_time || '18:00',
    }
  }
}
