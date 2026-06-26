import { useState, useEffect } from 'react'
import { Printer, Save } from 'lucide-react'
import { useApp } from '../../context/SupabaseAppContext'
import { swalConfig } from '../../lib/sweetAlert'

interface KitchenConfig {
  printerEnabled: boolean
  printerId: string
  stationAssignments: Record<string, string>
}

const DEFAULT_CONFIG: KitchenConfig = {
  printerEnabled: false,
  printerId: '',
  stationAssignments: {
    espresso: 'espresso',
    bar: 'bar',
    food: 'food',
    pastry: 'pastry',
  },
}

export function KitchenSettings() {
  const { state } = useApp()
  const isTouchMode = state.settings.interfaceMode === 'touch'
  const [config, setConfig] = useState<KitchenConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)

  // Load config from localStorage (simple persistence — no DB table needed)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kitchen_config')
      if (stored) setConfig(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      localStorage.setItem('kitchen_config', JSON.stringify(config))
      await swalConfig.success('Kitchen configuration saved.')
    } catch {
      swalConfig.error('Failed to save configuration.')
    } finally {
      setSaving(false)
    }
  }

  const updateStation = (category: string, station: string) => {
    setConfig(prev => ({
      ...prev,
      stationAssignments: { ...prev.stationAssignments, [category]: station },
    }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className={`font-bold font-fraunces text-[#473b32] dark:text-[#f0ece5] ${isTouchMode ? 'text-2xl' : 'text-xl'}`}>
        Kitchen Display Settings
      </h2>

      {/* Printer Configuration */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Printer className="h-5 w-5 text-[#9a693a]" />
          <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5]">Printer Configuration</h3>
        </div>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.printerEnabled}
            onChange={e => setConfig(prev => ({ ...prev, printerEnabled: e.target.checked }))}
            className="h-5 w-5 rounded border-[#ded7cc] text-[#9a693a] focus:ring-[#9a693a]"
          />
          <span className="text-sm text-[#473b32] dark:text-[#f0ece5]">Enable kitchen printer</span>
        </label>

        {config.printerEnabled && (
          <div>
            <label className="block text-sm font-medium text-[#473b32] dark:text-[#f0ece5] mb-2">
              Printer ID
            </label>
            <input
              type="text"
              value={config.printerId}
              onChange={e => setConfig(prev => ({ ...prev, printerId: e.target.value }))}
              className="input"
              placeholder="e.g., kitchen-printer-01"
            />
          </div>
        )}
      </div>

      {/* Station Assignment */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-[#473b32] dark:text-[#f0ece5]">Station Assignments</h3>
        <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab]">
          Map product categories to kitchen stations
        </p>

        <div className="space-y-3">
          {Object.entries(config.stationAssignments).map(([category, station]) => (
            <div key={category} className="flex items-center space-x-3">
              <span className="w-24 text-sm font-medium text-[#473b32] dark:text-[#f0ece5] capitalize">{category}</span>
              <select
                value={station}
                onChange={e => updateStation(category, e.target.value)}
                className="select flex-1"
              >
                <option value="bar">Bar</option>
                <option value="espresso">Espresso</option>
                <option value="food">Food</option>
                <option value="pastry">Pastry</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center space-x-2"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>Save Configuration</span>
        </button>
      </div>
    </div>
  )
}
