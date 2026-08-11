import { useState } from 'react';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../hooks/useApp';
import { settingsService } from '../../lib/services/settings';
import { sendDailyReport } from '../../lib/services/dailyReport';
import { buildDailyReportBody, DAILY_REPORT_SENT_KEY } from '../../lib/dailyReport';

const CHANNEL_OPTIONS: { value: 'none' | 'whatsapp' | 'discord'; label: string; hint: string }[] = [
  { value: 'none', label: 'Off', hint: 'No daily report is sent.' },
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Delivered to a phone number via WhatsApp.' },
  { value: 'discord', label: 'Discord', hint: 'Delivered to a channel via a webhook URL.' },
];

export function NotificationChannelConfig() {
  const { state } = useApp();
  const settings = state.settings;
  const [channel, setChannel] = useState<'none' | 'whatsapp' | 'discord'>(settings.notificationChannel ?? 'none');
  const [recipientPhone, setRecipientPhone] = useState(settings.whatsappRecipientPhone ?? '');
  const [webhookUrl, setWebhookUrl] = useState(settings.discordWebhookUrl ?? '');
  const [reportTime, setReportTime] = useState(settings.whatsappReportTime ?? '18:00');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsService.update({
        notificationChannel: channel,
        whatsappRecipientPhone: recipientPhone,
        discordWebhookUrl: webhookUrl,
        whatsappReportTime: reportTime,
      });
      swalConfig.success('Notification settings saved');
    } catch {
      swalConfig.error('Failed to save notification settings');
    }
    setSaving(false);
  }

  async function handleSendNow() {
    if (channel === 'none') {
      swalConfig.error('Enable a channel (WhatsApp or Discord) before sending');
      return;
    }
    if (channel === 'whatsapp' && !recipientPhone.trim()) {
      swalConfig.error('Enter a WhatsApp recipient phone number');
      return;
    }
    if (channel === 'discord' && !webhookUrl.trim()) {
      swalConfig.error('Enter a Discord webhook URL');
      return;
    }
    setSending(true);
    try {
      const result = await sendDailyReport(channel, state.sales, state.shop?.id ?? '');
      if (result.success) {
        // Suppress the auto-send for the rest of today.
        localStorage.setItem(DAILY_REPORT_SENT_KEY, new Date().toDateString());
        swalConfig.success('Daily report sent');
      } else {
        swalConfig.error(result.error || 'Failed to send daily report');
      }
    } catch {
      swalConfig.error('Failed to send daily report');
    }
    setSending(false);
  }

  const activeChannel = CHANNEL_OPTIONS.find((c) => c.value === channel);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          Daily Report Notifications
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
          Configure an automatic daily sales summary — revenue, transactions, and top products —
          delivered to WhatsApp or Discord.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              Delivery Channel
            </label>
            <div className="flex gap-3 flex-wrap">
              {CHANNEL_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`btn btn-sm ${channel === c.value ? 'btn-success' : 'btn-ghost'}`}
                  onClick={() => setChannel(c.value)}
                  aria-pressed={channel === c.value}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#a8978a] dark:text-[#8a7d70]">{activeChannel?.hint}</p>
          </div>

          {channel === 'whatsapp' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                Recipient Phone Number
              </label>
              <input
                type="text"
                className="input"
                placeholder="+95 9 xxx xxx xxx"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
          )}

          {channel === 'discord' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                Discord Webhook URL
              </label>
              <input
                type="url"
                className="input"
                placeholder="https://discord.com/api/webhooks/…"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
              Report Time
            </label>
            <input
              type="time"
              className="input"
              value={reportTime}
              onChange={(e) => setReportTime(e.target.value)}
            />
            <p className="text-xs text-[#a8978a] dark:text-[#8a7d70]">
              Daily report will be sent at this time each day while the POS is open.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              className="btn btn-ghost btn-md"
              onClick={handleSendNow}
              disabled={sending || channel === 'none'}
            >
              {sending ? 'Sending…' : 'Send Now'}
            </button>
            <button
              className="btn btn-primary btn-md"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="card p-5">
        <h4 className="font-medium text-secondary-900 dark:text-secondary-100 mb-3">Preview</h4>
        <pre className="bg-secondary-100 dark:bg-[#3d2d1f] rounded-xl p-4 text-sm whitespace-pre-wrap font-mono text-secondary-600 dark:text-secondary-300">
          {buildDailyReportBody(state.sales)}
        </pre>
        <p className="mt-2 text-xs text-[#a8978a] dark:text-[#8a7d70]">
          {channel === 'none'
            ? 'Reports disabled'
            : channel === 'whatsapp'
              ? `Sent to ${recipientPhone || '…'} at ${reportTime}`
              : `Sent to Discord webhook at ${reportTime}`}
        </p>
        <p className="mt-1 text-[10px] text-[#a8978a] dark:text-[#8a7d70]">
          Preview shows live data for today.
        </p>
      </div>
    </div>
  );
}
