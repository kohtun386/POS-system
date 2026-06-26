import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { RefreshCw, Coffee, Utensils, Cake, Martini } from 'lucide-react'
import { KitchenOrder, KitchenStation } from '../../types'
import { kitchenOrdersService } from '../../lib/services'
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/SupabaseAppContext'
import { KitchenOrderCard } from './KitchenOrderCard'
import { ErrorBoundary } from '../ui/ErrorBoundary'

/** Raw row shape from kitchen_orders postgres_changes events */
interface KitchenOrderRow {
  id: string
  shop_id: string
  items: Record<string, unknown> | unknown[]
  status: string
  started_at?: string
  completed_at?: string
  picked_up_at?: string
  created_at: string
}

type StationTab = 'all' | KitchenStation

const STATION_TABS: { id: StationTab; label: string; icon: typeof Coffee }[] = [
  { id: 'all', label: 'All', icon: RefreshCw },
  { id: 'bar', label: 'Bar', icon: Martini },
  { id: 'espresso', label: 'Espresso', icon: Coffee },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'pastry', label: 'Pastry', icon: Cake },
]

function KitchenDisplayInner() {
  const { state } = useApp()
  const { user } = useAuth()
  const isTouchMode = state.settings.interfaceMode === 'touch'
  const shopId = state.activeShopId

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [activeStation, setActiveStation] = useState<StationTab>('all')
  const [loading, setLoading] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Audio alert for new orders
  const playAlert = useCallback(() => {
    if (!audioEnabled) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      // Audio not available
    }
  }, [audioEnabled])

  // Realtime subscription
  useRealtimeSubscription({
    table: 'kitchen_orders',
    filter: shopId ? `shop_id=eq.${shopId}` : undefined,
    onInsert: (row: KitchenOrderRow) => {
      const raw = row.items as Record<string, unknown> | undefined
      const hasPayload = raw && typeof raw === 'object' && !Array.isArray(raw) && 'lineItems' in raw
      const unpacked = hasPayload
        ? { items: raw.lineItems as KitchenOrder['items'], saleId: raw.saleId as string | undefined, station: raw.station as KitchenStation | undefined }
        : { items: (row.items as KitchenOrder['items']) || [], saleId: undefined, station: undefined }
      const newOrder: KitchenOrder = {
        id: row.id,
        shopId: row.shop_id,
        saleId: unpacked.saleId,
        station: unpacked.station,
        items: unpacked.items,
        status: row.status,
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at) : undefined,
        createdAt: new Date(row.created_at),
      }
      setOrders(prev => [newOrder, ...prev])
      playAlert()
    },
    onUpdate: (row: KitchenOrderRow) => {
      const raw = row.items as Record<string, unknown> | undefined
      const hasPayload = raw && typeof raw === 'object' && !Array.isArray(raw) && 'lineItems' in raw
      const unpacked = hasPayload
        ? { items: raw.lineItems as KitchenOrder['items'], saleId: raw.saleId as string | undefined, station: raw.station as KitchenStation | undefined }
        : { items: (row.items as KitchenOrder['items']) || [], saleId: undefined, station: undefined }
      const updated: KitchenOrder = {
        id: row.id,
        shopId: row.shop_id,
        saleId: unpacked.saleId,
        station: unpacked.station,
        items: unpacked.items,
        status: row.status,
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
        pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at) : undefined,
        createdAt: new Date(row.created_at),
      }
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    },
    onDelete: (row: KitchenOrderRow) => {
      setOrders(prev => prev.filter(o => o.id !== row.id))
    },
    enabled: !!shopId,
  })

  // Initial fetch
  useEffect(() => {
    if (!shopId) return
    let cancelled = false
    setLoading(true)
    kitchenOrdersService.getAll()
      .then(data => {
        if (!cancelled) setOrders(data)
      })
      .catch(err => console.error('Failed to load kitchen orders:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [shopId])

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (activeStation !== 'all' && o.station !== activeStation) return false
    return true
  })

  // Group by status
  const pending = filteredOrders.filter(o => o.status === 'pending')
  const inProgress = filteredOrders.filter(o => o.status === 'in_progress')
  const ready = filteredOrders.filter(o => o.status === 'ready')

  // Role check for cancel permission
  const canCancel = user?.user_metadata?.role === 'admin' || user?.user_metadata?.role === 'manager'

  const handleStatusChange = (updated: KitchenOrder) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className={`font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5] ${isTouchMode ? 'text-2xl' : 'text-xl'}`}>
          Kitchen Display
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`btn btn-ghost btn-sm text-xs ${audioEnabled ? 'text-green-600' : 'text-gray-400'}`}
          >
            {audioEnabled ? '🔔' : '🔕'}
          </button>
          <span className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">
            {pending.length} pending · {inProgress.length} in progress · {ready.length} ready
          </span>
        </div>
      </div>

      {/* Station Tabs */}
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        {STATION_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveStation(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeStation === tab.id
                ? 'bg-[#9a693a] text-white dark:bg-[#cfa16a] dark:text-[#1a0f08]'
                : 'bg-[#f0ece5] text-[#7d6b57] dark:bg-[#2a1a10] dark:text-[#c6bbab] hover:bg-[#ded7cc] dark:hover:bg-[#3b2613]'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9a693a]" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {/* Pending Column */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center space-x-2 mb-3 px-1">
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <h2 className="font-semibold text-sm text-[#473b32] dark:text-[#f0ece5] uppercase tracking-wide">
                Pending ({pending.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <AnimatePresence mode="popLayout">
                {pending.map(order => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    isTouchMode={isTouchMode}
                    canCancel={canCancel}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </AnimatePresence>
              {pending.length === 0 && (
                <div className="text-center py-8 text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                  No pending orders
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center space-x-2 mb-3 px-1">
              <div className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" />
              <h2 className="font-semibold text-sm text-[#473b32] dark:text-[#f0ece5] uppercase tracking-wide">
                In Progress ({inProgress.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <AnimatePresence mode="popLayout">
                {inProgress.map(order => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    isTouchMode={isTouchMode}
                    canCancel={canCancel}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </AnimatePresence>
              {inProgress.length === 0 && (
                <div className="text-center py-8 text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                  No orders in progress
                </div>
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center space-x-2 mb-3 px-1">
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <h2 className="font-semibold text-sm text-[#473b32] dark:text-[#f0ece5] uppercase tracking-wide">
                Ready ({ready.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <AnimatePresence mode="popLayout">
                {ready.map(order => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    isTouchMode={isTouchMode}
                    canCancel={canCancel}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </AnimatePresence>
              {ready.length === 0 && (
                <div className="text-center py-8 text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                  No orders ready
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Wrap in ErrorBoundary
export function KitchenDisplay() {
  return (
    <ErrorBoundary>
      <KitchenDisplayInner />
    </ErrorBoundary>
  )
}
