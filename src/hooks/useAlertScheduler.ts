import { useEffect, useRef } from 'react'
import { alertService } from '../lib/alertService'

export function useAlertScheduler(intervalMinutes: number = 60) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const startScheduler = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      runAlertCheck()
      intervalRef.current = setInterval(() => {
        runAlertCheck()
      }, intervalMinutes * 60 * 1000)
    }

    const runAlertCheck = async () => {
      try {
        console.log('Running scheduled alert check...')
        const results = await alertService.runAlertCheck()
        if (results.length > 0) {
          const successfulAlerts = results.filter(r => r.shouldSend).length
          console.log(`Alert check completed: ${successfulAlerts}/${results.length} alerts sent`)
        }
      } catch (error) {
        console.error('Error in scheduled alert check:', error)
      }
    }

    startScheduler()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [intervalMinutes])

  return {
    runManualCheck: async () => {
      try {
        const results = await alertService.runAlertCheck()
        return results
      } catch (error) {
        console.error('Error in manual alert check:', error)
        throw error
      }
    }
  }
}
