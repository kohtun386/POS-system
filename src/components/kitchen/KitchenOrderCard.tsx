import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Play, CheckCircle, ArrowRight, X } from 'lucide-react'
import { KitchenOrder, KitchenOrderStatus } from '../../types'
import { kitchenOrdersService } from '../../lib/services'

interface KitchenOrderCardProps {
  order: KitchenOrder
  onStatusChange?: (order: KitchenOrder) => void
  isTouchMode?: boolean
  canCancel?: boolean
}

function getElapsedMinutes(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / 60_000)
}

function getTimerColor(minutes: number): string {
  if (minutes < 5) return 'text-green-600 dark:text-green-400'
  if (minutes < 10) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getStationBadge(station?: string): string {
  const map: Record<string, string> = {
    bar: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    espresso: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    food: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    pastry: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  }
  return map[station || 'bar'] || map.bar
}

export function KitchenOrderCard({ order, onStatusChange, isTouchMode = true, canCancel = false }: KitchenOrderCardProps) {
  const [elapsed, setElapsed] = useState(getElapsedMinutes(order.createdAt))
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedMinutes(order.createdAt))
    }, 60_000)
    return () => clearInterval(interval)
  }, [order.createdAt])

  const handleStatusChange = async (newStatus: KitchenOrderStatus) => {
    setUpdating(true)
    try {
      const updated = await kitchenOrdersService.updateStatus(order.id, newStatus)
      onStatusChange?.(updated)
    } catch (err) {
      console.error('Failed to update kitchen order status:', err)
    } finally {
      setUpdating(false)
    }
  }

  const statusActions: Record<KitchenOrderStatus, { label: string; icon: typeof Play; next: KitchenOrderStatus; color: string } | null> = {
    pending: { label: 'Start', icon: Play, next: 'in_progress', color: 'btn-primary' },
    in_progress: { label: 'Ready', icon: CheckCircle, next: 'ready', color: 'btn-success' },
    ready: { label: 'Picked Up', icon: ArrowRight, next: 'picked_up', color: 'btn-secondary' },
    picked_up: null,
    cancelled: null,
  }

  const action = statusActions[order.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`bg-white dark:bg-[#1a0f08] rounded-2xl border border-[#ded7cc] dark:border-[#54463b] shadow-sm p-4 ${
        isTouchMode ? 'min-h-[140px]' : 'min-h-[120px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStationBadge(order.station)}`}>
            {(order.station || 'bar').toUpperCase()}
          </span>
          <span className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">
            #{order.id.slice(-6)}
          </span>
        </div>
        <div className={`flex items-center space-x-1 text-sm font-mono ${getTimerColor(elapsed)}`}>
          <Clock className="h-3.5 w-3.5" />
          <span>{elapsed}m</span>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1 mb-4">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="text-[#473b32] dark:text-[#f0ece5] font-medium truncate flex-1 mr-2">
              {item.productName}
            </span>
            <span className="text-[#7d6b57] dark:text-[#c6bbab] font-semibold">
              ×{item.quantity}
            </span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      {action && (
        <button
          onClick={() => handleStatusChange(action.next)}
          disabled={updating}
          className={`btn ${action.color} w-full ${isTouchMode ? 'min-h-[48px] text-base' : 'min-h-[40px] text-sm'} flex items-center justify-center space-x-2`}
        >
          {updating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <action.icon className="h-4 w-4" />
              <span>{action.label}</span>
            </>
          )}
        </button>
      )}

      {/* Cancel button (admin/manager only) */}
      {canCancel && order.status !== 'cancelled' && order.status !== 'picked_up' && (
        <button
          onClick={() => handleStatusChange('cancelled')}
          disabled={updating}
          className="btn btn-ghost w-full mt-2 min-h-[36px] text-xs text-red-500 hover:text-red-700 flex items-center justify-center space-x-1"
        >
          <X className="h-3.5 w-3.5" />
          <span>Cancel</span>
        </button>
      )}
    </motion.div>
  )
}
