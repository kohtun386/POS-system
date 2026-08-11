import type { Sale } from '../types'

/** localStorage key for the once-per-day daily-report guard. */
export const DAILY_REPORT_SENT_KEY = 'coffee-pos:daily-report-sent'

/** Build the plain-text daily sales report body for a given day. */
export function buildDailyReportBody(sales: Sale[]): string {
  const dayKey = new Date().toDateString()
  const todays = sales.filter((s) => new Date(s.timestamp).toDateString() === dayKey)

  const revenue = todays.reduce((sum, s) => sum + (s.total ?? 0), 0)
  const transactions = todays.length

  const perProduct = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of todays) {
    for (const item of sale.items) {
      const name = item.product?.name ?? 'Unknown item'
      const entry = perProduct.get(name) ?? { name, qty: 0, revenue: 0 }
      entry.qty += item.quantity ?? 0
      entry.revenue += item.subtotal ?? 0
      perProduct.set(name, entry)
    }
  }

  const topProducts = [...perProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const lines = [
    '☕ Daily Sales Report',
    `📅 ${new Date().toDateString()}`,
    `💰 Revenue: ${revenue.toFixed(2)}`,
    `🧾 Transactions: ${transactions}`,
  ]
  if (topProducts.length > 0) {
    lines.push('📦 Top Products:')
    for (const p of topProducts) {
      lines.push(`  • ${p.name} — ${p.qty} × ${p.revenue.toFixed(2)}`)
    }
  }
  return lines.join('\n')
}
