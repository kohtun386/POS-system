import { supabase } from '../supabase'
import { buildDailyReportBody } from '../dailyReport'
import type { Sale } from '../../types'

export interface DailyReportResult {
  success: boolean
  error?: string
}

/**
 * Send today's daily sales report to the configured channel via the
 * send-notification Edge Function. The channel is passed through and the
 * EF resolves the destination (webhook URL / phone) server-side from
 * app_settings — credentials never reach the client.
 */
export async function sendDailyReport(
  channel: 'whatsapp' | 'discord',
  sales: Sale[],
  shopId: string,
): Promise<DailyReportResult> {
  const body = buildDailyReportBody(sales)
  const recipient = channel === 'whatsapp' ? { name: 'Shop owner' } : { name: 'Discord' }

  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: {
      alert_type: 'daily_report',
      recipient,
      template: { subject: 'Daily Sales Report', body },
      channel,
      shop_id: shopId,
    },
  })

  if (error) {
    return { success: false, error: error.message || 'Failed to send daily report' }
  }

  return (data as DailyReportResult) ?? { success: false, error: 'Empty response from send-notification' }
}
