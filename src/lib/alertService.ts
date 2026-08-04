import { supabase } from './supabase';
import {
    alertConfigurationsService,
    alertTemplatesService,
    alertRecipientsService,
    alertHistoryService,
} from './services/alerts';
import { productsService } from './services/products';
import {
    AlertRecipient,
    AlertTemplate,
    AlertConfiguration,
    AlertHistory,
    InventoryAlert,
    AlertType,
    AlertContext,
    Product
} from '../types';

interface ProcessedAlert {
    alert: InventoryAlert;
    recipients: AlertRecipient[];
    shouldSend: boolean;
    reason?: string;
}

// Alert Service Class
export class AlertService {
    // Template processing with variable substitution
    private processTemplate(template: string, context: AlertContext): string {
        const variables = {
            '{{product_name}}': context.product.name,
            '{{product_sku}}': context.product.sku,
            '{{product_category}}': context.product.category,
            '{{current_stock}}': (context.product.stock ?? 0).toString(),
            '{{min_stock}}': (context.product.minStock ?? 0).toString(),
            '{{recipient_name}}': context.recipient.name,
            '{{store_name}}': 'Your Store', // This should come from app settings
            '{{alert_type}}': context.template.type,
            '{{threshold_value}}': context.configuration.thresholdValue?.toString() || '',
        };

        let processedTemplate = template;
        Object.entries(variables).forEach(([placeholder, value]) => {
            processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
        });

        return processedTemplate;
    }

    // Check if alert should be sent (cooldown logic)
    private async shouldSendAlert(
        productId: string,
        alertType: AlertType,
        recipientId: string
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase.rpc('should_send_alert', {
                product_id_param: productId,
                alert_type_param: alertType,
                recipient_id_param: recipientId,
            });

            if (error) {
                console.error('Error checking alert cooldown:', error);
                return false;
            }

            return data || false;
        } catch (error) {
            console.error('Error checking alert cooldown:', error);
            return false;
        }
    }

    // Send notification via Edge Function (credentials never touch frontend)
    private async sendViaEdgeFunction(
        payload: {
            alert_type: string;
            recipient: { email?: string; phone?: string; name: string };
            template: { subject?: string; body: string };
            channel: 'email' | 'sms';
            shop_id: string;
        }
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            const { data, error } = await supabase.functions.invoke('send-notification', {
                body: payload,
            });

            if (error) {
                console.error('Edge Function error:', error);
                return { success: false, error: error.message || 'Failed to send notification' };
            }

            return data as { success: boolean; messageId?: string; error?: string };
        } catch (error) {
            console.error('Error invoking send-notification Edge Function:', error);
            return { success: false, error: `Network error: ${error}` };
        }
    }

    // Record alert in history
    private async recordAlertHistory(
        alert: InventoryAlert,
        recipient: AlertRecipient,
        template: AlertTemplate,
        channel: 'email' | 'sms',
        status: 'pending' | 'sent' | 'failed' | 'delivered',
        messageContent?: string,
        errorMessage?: string
    ): Promise<void> {
        try {
            const alertHistory: Omit<AlertHistory, 'id'> = {
                alertType: alert.alertType,
                productId: alert.productId,
                productName: alert.productName,
                productSku: alert.productSku,
                currentStock: alert.currentStock,
                minStock: alert.minStock,
                thresholdValue: alert.thresholdValue,
                recipientId: recipient.id,
                recipientName: recipient.name,
                recipientEmail: recipient.email,
                recipientPhone: recipient.phone,
                channel,
                status,
                templateId: template.id,
                messageContent,
                errorMessage,
                sentAt: status === 'sent' || status === 'delivered' ? new Date() : undefined,
                deliveredAt: status === 'delivered' ? new Date() : undefined,
                createdAt: new Date(),
            };

            await alertHistoryService.create(alertHistory);
        } catch (error) {
            console.error('Error recording alert history:', error);
        }
    }

    // Main method to process and send alerts
    async processAlert(alert: InventoryAlert): Promise<ProcessedAlert> {
        try {
            // Get alert configuration via service
            const configuration = await alertConfigurationsService.getByType(alert.alertType);

            if (!configuration) {
                return {
                    alert,
                    recipients: [],
                    shouldSend: false,
                    reason: 'Alert configuration not found or disabled',
                };
            }

            // Get recipients for this alert type via service
            const recipients = await alertRecipientsService.getByAlertType(alert.alertType);

            if (!recipients || recipients.length === 0) {
                return {
                    alert,
                    recipients: [],
                    shouldSend: false,
                    reason: 'No active recipients found for this alert type',
                };
            }

            // Get product details via service
            const product = await productsService.getById(alert.productId);

            if (!product) {
                return {
                    alert,
                    recipients: [],
                    shouldSend: false,
                    reason: 'Product not found',
                };
            }

            // Get templates via service
            const [emailTemplate, smsTemplate] = await Promise.all([
                alertTemplatesService.getByTypeAndChannel(alert.alertType, 'email'),
                alertTemplatesService.getByTypeAndChannel(alert.alertType, 'sms'),
            ]);

            // Get shop ID from current context
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return {
                    alert,
                    recipients: [],
                    shouldSend: false,
                    reason: 'User not authenticated',
                };
            }

            const { data: membership } = await supabase
                .from('shop_memberships')
                .select('shop_id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            if (!membership) {
                return {
                    alert,
                    recipients: [],
                    shouldSend: false,
                    reason: 'No active shop membership found',
                };
            }

            const shop_id = membership.shop_id;

            // Process each recipient
            const processedRecipients: AlertRecipient[] = [];

            for (const recipient of recipients) {
                // Check cooldown
                const shouldSend = await this.shouldSendAlert(alert.productId, alert.alertType, recipient.id);

                if (!shouldSend) {
                    continue;
                }

                processedRecipients.push(recipient);

                // Create alert context
                const context: AlertContext = {
                    product: product as Product,
                    recipient: recipient as AlertRecipient,
                    template: (emailTemplate || smsTemplate) as AlertTemplate,
                    configuration: configuration as AlertConfiguration,
                };

                // Send email if configured and recipient has email
                if (emailTemplate && recipient.email) {
                    const emailPayload = {
                        alert_type: alert.alertType,
                        recipient: {
                            email: recipient.email,
                            name: recipient.name,
                        },
                        template: {
                            subject: this.processTemplate(emailTemplate.subject || '', context),
                            body: this.processTemplate(emailTemplate.body, context),
                        },
                        channel: 'email' as const,
                        shop_id,
                    };

                    const emailResult = await this.sendViaEdgeFunction(emailPayload);

                    await this.recordAlertHistory(
                        alert,
                        recipient,
                        emailTemplate as AlertTemplate,
                        'email',
                        emailResult.success ? 'sent' : 'failed',
                        emailResult.success ? 'Email sent successfully' : emailResult.error,
                        emailResult.error
                    );
                }

                // Send SMS if configured and recipient has phone
                if (smsTemplate && recipient.phone) {
                    const smsPayload = {
                        alert_type: alert.alertType,
                        recipient: {
                            phone: recipient.phone,
                            name: recipient.name,
                        },
                        template: {
                            body: this.processTemplate(smsTemplate.body, context),
                        },
                        channel: 'sms' as const,
                        shop_id,
                    };

                    const smsResult = await this.sendViaEdgeFunction(smsPayload);

                    await this.recordAlertHistory(
                        alert,
                        recipient,
                        smsTemplate as AlertTemplate,
                        'sms',
                        smsResult.success ? 'sent' : 'failed',
                        smsResult.success ? 'SMS sent successfully' : smsResult.error,
                        smsResult.error
                    );
                }
            }

            return {
                alert,
                recipients: processedRecipients,
                shouldSend: processedRecipients.length > 0,
                reason: processedRecipients.length > 0 ? 'Alerts sent successfully' : 'No recipients available or cooldown active',
            };
        } catch (error) {
            console.error('Error processing alert:', error);
            return {
                alert,
                recipients: [],
                shouldSend: false,
                reason: `Error processing alert: ${error}`,
            };
        }
    }

    // Check inventory levels and trigger alerts
    async checkInventoryLevels(): Promise<InventoryAlert[]> {
        try {
            const { data, error } = await supabase.rpc('check_inventory_alerts');

            if (error) {
                console.error('Error checking inventory levels:', error);
                return [];
            }

            return (data || []).map((row: Record<string, unknown>) => ({
                alertType: row.alert_type as InventoryAlert['alertType'],
                productId: row.product_id as string,
                productName: row.product_name as string,
                productSku: row.product_sku as string,
                currentStock: row.current_stock as number,
                minStock: row.min_stock as number,
                thresholdValue: row.threshold_value as number,
            }));
        } catch (error) {
            console.error('Error checking inventory levels:', error);
            return [];
        }
    }

    // Run the complete alert check process
    async runAlertCheck(): Promise<ProcessedAlert[]> {
        const alerts = await this.checkInventoryLevels();
        const processedAlerts: ProcessedAlert[] = [];

        for (const alert of alerts) {
            const processedAlert = await this.processAlert(alert);
            processedAlerts.push(processedAlert);
        }

        return processedAlerts;
    }
}

// Export singleton instance
export const alertService = new AlertService();