import { useEffect, useRef } from 'react';
import { sendDailyReport } from '../lib/services/dailyReport';
import { DAILY_REPORT_SENT_KEY } from '../lib/dailyReport';
import type { Sale } from '../types';

const CHECK_INTERVAL_MS = 60 * 1000; // 60s
const SEND_KEY = DAILY_REPORT_SENT_KEY;

/**
 * Client-side daily report scheduler. While the POS is open, checks every 60s
 * whether the configured report time has passed today and the report hasn't
 * already been sent. A manual "Send now" and the auto-send share the same
 * once-per-day guard via localStorage, so a manual send suppresses the auto.
 */
export function useDailyReportScheduler(
  enabled: boolean,
  reportTime: string,
  channel: 'none' | 'whatsapp' | 'discord',
  sales: Sale[],
  shopId: string | undefined,
): void {
  const ref = useRef({ enabled, reportTime, channel, sales, shopId });

  useEffect(() => {
    ref.current = { enabled, reportTime, channel, sales, shopId };
  }, [enabled, reportTime, channel, sales, shopId]);

  useEffect(() => {
    if (!enabled || channel === 'none') return;

    const run = async () => {
      const cur = ref.current;
      if (!cur.enabled || cur.channel === 'none' || !cur.shopId) return;

      const now = new Date();
      const today = now.toDateString();
      if (localStorage.getItem(SEND_KEY) === today) return; // already sent today

      const [h, m] = (cur.reportTime || '18:00').split(':').map(Number);
      const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      if (now < due) return; // not due yet

      // Send at most once per day, even if multiple POS tabs are open.
      localStorage.setItem(SEND_KEY, today);
      await sendDailyReport(cur.channel, cur.sales, cur.shopId);
    };

    run();
    const id = setInterval(run, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interval runs once; reads fresh values via ref
  }, []);
}
