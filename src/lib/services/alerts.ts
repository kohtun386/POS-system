import { supabase } from '../supabase'
import type { AlertRecipient, AlertTemplate, AlertConfiguration, AlertHistory, NotificationServiceConfig } from '../../types'

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
  },

  async create(data: Omit<AlertHistory, 'id'>): Promise<void> {
    const { error } = await supabase
      .from('alert_history')
      .insert({
        alert_type: data.alertType,
        product_id: data.productId,
        product_name: data.productName,
        product_sku: data.productSku,
        current_stock: data.currentStock,
        min_stock: data.minStock,
        threshold_value: data.thresholdValue,
        recipient_id: data.recipientId,
        recipient_name: data.recipientName,
        recipient_email: data.recipientEmail,
        recipient_phone: data.recipientPhone,
        channel: data.channel,
        status: data.status,
        template_id: data.templateId,
        message_content: data.messageContent,
        error_message: data.errorMessage,
        sent_at: data.sentAt?.toISOString(),
        delivered_at: data.deliveredAt?.toISOString()
      })

    if (error) throw error
  }
}

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
