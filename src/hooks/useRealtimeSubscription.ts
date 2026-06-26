import { useEffect, useRef, useState, useCallback } from 'react'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

interface UseRealtimeSubscriptionOptions<T> {
  table: string
  filter?: string
  onInsert?: (row: T) => void
  onUpdate?: (row: T) => void
  onDelete?: (oldRow: T) => void
  enabled?: boolean
}

interface UseRealtimeSubscriptionResult<T> {
  isConnected: boolean
  lastEvent: RealtimeEvent | null
  latestRows: T[]
}

/**
 * Subscribe to Supabase Realtime postgres_changes on a table.
 * Auto-reconnect on disconnect. 10s polling fallback.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionOptions<T>): UseRealtimeSubscriptionResult<T> {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const [latestRows, setLatestRows] = useState<T[]>([])
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep callback refs current
  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate
  onDeleteRef.current = onDelete

  const handlePayload = useCallback((payload: RealtimePostgresChangesPayload<T>) => {
    const event = payload.eventType.toUpperCase() as RealtimeEvent
    setLastEvent(event)

    switch (event) {
      case 'INSERT':
        setLatestRows(prev => [payload.new, ...prev])
        onInsertRef.current?.(payload.new as T)
        break
      case 'UPDATE':
        setLatestRows(prev =>
          prev.map(row => ((row as Record<string, unknown>).id === (payload.new as Record<string, unknown>).id ? (payload.new as T) : row))
        )
        onUpdateRef.current?.(payload.new as T)
        break
      case 'DELETE':
        setLatestRows(prev =>
          prev.filter(row => (row as Record<string, unknown>).id !== (payload.old as Record<string, unknown>).id)
        )
        onDeleteRef.current?.(payload.old as T)
        break
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const channelName = `realtime-${table}-${Math.random().toString(36).slice(2, 6)}`

    const channelConfig: Record<string, unknown> = {
      event: '*',
      schema: 'public',
      table,
    }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, handlePayload)
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // Polling fallback — every 10s check connection, reconnect if needed
    pollingRef.current = setInterval(async () => {
      const state = supabase.getChannels()
      const ch = state.find(c => c.topic === channel.topic)
      if (!ch || ch.state !== 'joined') {
        console.warn(`[realtime] ${table} channel disconnected, reconnecting...`)
        try {
          channel.subscribe()
        } catch {
          // best-effort
        }
      }
    }, 10_000)

    return () => {
      clearInterval(pollingRef.current!)
      pollingRef.current = null
      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
    }
  }, [table, filter, enabled, handlePayload])

  return { isConnected, lastEvent, latestRows }
}
