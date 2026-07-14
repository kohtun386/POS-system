import { useState } from 'react';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { DEFAULT_CURRENCY } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

export function WhatsAppReportConfig() {
  const { state } = useApp();
  const [enabled, setEnabled] = useState(state.settings.whatsappReportsEnabled ?? false);
  const [recipientPhone, setRecipientPhone] = useState(state.settings.whatsappRecipientPhone ?? '');
  const [reportTime, setReportTime] = useState(state.settings.whatsappReportTime ?? '18:00');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .update({
        whatsapp_reports_enabled: enabled,
        whatsapp_recipient_phone: recipientPhone,
        whatsapp_report_time: reportTime,
      })
      .eq('id', state.settings.id);

    if (error) {
      swalConfig.error('Failed to save WhatsApp report settings');
    } else {
      swalConfig.success('WhatsApp report settings saved');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
          WhatsApp Daily Report
        </h3>
        <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
          Configure automatic daily sales reports sent to WhatsApp. Receive a summary of daily revenue, transactions, and top products.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-secondary-100 dark:border-[#3d2d1f]">
            <div>
              <div className="font-medium text-secondary-900 dark:text-secondary-100">Enable Reports</div>
              <div className="text-sm text-secondary-600 dark:text-secondary-300">
                Send daily summary to WhatsApp
              </div>
            </div>
            <button
              className={`btn btn-sm ${enabled ? 'btn-success' : 'btn-ghost'}`}
              onClick={() => setEnabled(!enabled)}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {enabled && (
            <>
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
                  Daily report will be sent at this time each day.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <button
              className="btn btn-primary"
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
        <div className="bg-secondary-100 dark:bg-[#3d2d1f] rounded-xl p-4 text-sm">
          <div className="font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
            ☕ Daily Sales Report
          </div>
          <div className="space-y-1 text-secondary-600 dark:text-secondary-300">
            <div>📅 {new Date().toLocaleDateString()}</div>
            <div>💰 Revenue: {DEFAULT_CURRENCY} —</div>
            <div>🧾 Transactions: —</div>
            <div>📦 Top Products: —</div>
            <div className="mt-2 text-xs text-[#a8978a]">
              {enabled ? `Sent to ${recipientPhone || '…'} at ${reportTime}` : 'Reports disabled'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
