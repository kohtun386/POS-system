import { useState, useEffect, useMemo } from 'react'
import { Calendar, TrendingUp, Clock, XCircle, BarChart3 } from 'lucide-react'
import { KitchenOrder, KitchenStation } from '../../types'
import { kitchenOrdersService } from '../../lib/services'
import { useApp } from '../../context/SupabaseAppContext'
import { ErrorBoundary } from '../ui/ErrorBoundary'

interface DateRange {
  from: Date
  to: Date
}

function getDefaultRange(): DateRange {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)
  return { from, to }
}

function avgPrepTime(orders: KitchenOrder[]): string {
  const completed = orders.filter(o => o.startedAt && o.completedAt)
  if (completed.length === 0) return '—'
  const totalMs = completed.reduce((sum, o) => {
    return sum + (o.completedAt!.getTime() - o.startedAt!.getTime())
  }, 0)
  const avgMin = Math.round(totalMs / completed.length / 60_000)
  return `${avgMin}m`
}

function onTimePercent(orders: KitchenOrder[]): string {
  const completed = orders.filter(o => o.startedAt && o.completedAt)
  if (completed.length === 0) return '—'
  const onTime = completed.filter(o => {
    const prepMs = o.completedAt!.getTime() - o.startedAt!.getTime()
    return prepMs <= 10 * 60_000 // 10 minutes threshold
  })
  return `${Math.round((onTime.length / completed.length) * 100)}%`
}

function cancelRate(orders: KitchenOrder[]): string {
  if (orders.length === 0) return '—'
  const cancelled = orders.filter(o => o.status === 'cancelled')
  return `${Math.round((cancelled.length / orders.length) * 100)}%`
}

function stationLoad(orders: KitchenOrder[]): Record<KitchenStation, number> {
  const counts: Record<KitchenStation, number> = { bar: 0, espresso: 0, food: 0, pastry: 0 }
  for (const o of orders) {
    if (o.station && o.station in counts) {
      counts[o.station]++
    }
  }
  return counts
}

function KitchenStatsInner() {
  const { state } = useApp()
  const isTouchMode = state.settings.interfaceMode === 'touch'
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    kitchenOrdersService.getAll()
      .then(data => {
        if (!cancelled) {
          const filtered = data.filter(o => {
            const d = o.createdAt
            return d >= dateRange.from && d <= dateRange.to
          })
          setOrders(filtered)
        }
      })
      .catch(err => console.error('Failed to load kitchen stats:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [dateRange])

  const stats = useMemo(() => ({
    total: orders.length,
    avgPrepTime: avgPrepTime(orders),
    onTime: onTimePercent(orders),
    cancelRate: cancelRate(orders),
    stationLoad: stationLoad(orders),
    ordersPerHour: orders.length > 0
      ? (orders.length / Math.max(1, (dateRange.to.getTime() - dateRange.from.getTime()) / 3_600_000)).toFixed(1)
      : '0',
  }), [orders, dateRange])

  const statCards = [
    { label: 'Total Orders', value: stats.total, icon: BarChart3, color: 'text-[#9a693a]' },
    { label: 'Avg Prep Time', value: stats.avgPrepTime, icon: Clock, color: 'text-blue-600' },
    { label: 'Orders/Hour', value: stats.ordersPerHour, icon: TrendingUp, color: 'text-green-600' },
    { label: 'On-Time %', value: stats.onTime, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Cancel Rate', value: stats.cancelRate, icon: XCircle, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5] ${isTouchMode ? 'text-2xl' : 'text-xl'}`}>
          Kitchen Analytics
        </h2>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-[#7d6b57]" />
          <input
            type="date"
            value={dateRange.from.toISOString().split('T')[0]}
            onChange={e => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
            className="input input-sm"
          />
          <span className="text-[#7d6b57]">to</span>
          <input
            type="date"
            value={dateRange.to.toISOString().split('T')[0]}
            onChange={e => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
            className="input input-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9a693a]" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statCards.map(card => (
              <div key={card.label} className="stat-card">
                <card.icon className={`h-5 w-5 ${card.color} mb-2`} />
                <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">{card.value}</div>
                <div className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Station Load */}
          <div className="card p-4">
            <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5] mb-4">Station Load</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['bar', 'espresso', 'food', 'pastry'] as KitchenStation[]).map(station => (
                <div key={station} className="text-center p-3 bg-[#f0ece5]/50 dark:bg-[#2a1a10]/50 rounded-xl">
                  <div className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">
                    {stats.stationLoad[station]}
                  </div>
                  <div className="text-xs text-[#7d6b57] dark:text-[#c6bbab] uppercase">{station}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function KitchenStats() {
  return (
    <ErrorBoundary>
      <KitchenStatsInner />
    </ErrorBoundary>
  )
}
