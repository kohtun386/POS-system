// DEPRECATED: Capabilities are now managed server-side via shop_capabilities table.
// This component is kept for backward compatibility but should not be used for new features.
// Use useCapability() from SupabaseAppContext instead.
// @deprecated — remove after all callers migrate to platform admin feature management.
import { useState, useEffect } from 'react';
import { useApp } from '../../context/SupabaseAppContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlag';
import { shopFeaturesService, featureDefinitionsService } from '../../lib/services';
import { FeatureDefinition } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';

/**
 * @deprecated Feature flags are now managed server-side via platform admin.
 * This component is kept for backward compatibility. New shops use capabilities.
 */
export function FeatureFlagsManager() {
  const { state, dispatch } = useApp();
  const featureFlags = useFeatureFlags();
  const [definitions, setDefinitions] = useState<FeatureDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // C-1 fix: Load feature definitions from DB instead of hardcoding
  useEffect(() => {
    async function loadDefinitions() {
      try {
        const defs = await featureDefinitionsService.getAll();
        setDefinitions(defs);
      } catch (err) {
        console.error('Failed to load feature definitions:', err);
        setError('Failed to load feature definitions');
      } finally {
        setLoading(false);
      }
    }
    loadDefinitions();
  }, []);

  const categories = [
    { key: 'pos', label: 'POS', color: 'text-[#9a693a]' },
    { key: 'inventory', label: 'Inventory', color: 'text-[#22c55e]' },
    { key: 'customers', label: 'Customers', color: 'text-[#f57323]' },
    { key: 'general', label: 'General', color: 'text-[#7a4f2c]' },
    { key: 'kitchen', label: 'Kitchen', color: 'text-[#e55c13]' },
  ];

  // C-1 fix: Build feature list from DB definitions
  const features = definitions.map(def => ({
    key: def.key,
    name: def.name,
    description: def.description,
    category: def.category,
  }));

  // W-2 fix: try/catch with optimistic rollback on toggle failure
  const handleToggle = async (key: string) => {
    const newValue = !featureFlags[key];
    dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: { key, enabled: newValue } });
    try {
      await shopFeaturesService.setFeature(state.activeShopId, key, newValue);
    } catch (err) {
      console.error('Failed to toggle feature flag:', err);
      // Rollback optimistic update
      dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: { key, enabled: !newValue } });
      swalConfig.error(`Failed to update feature "${key}". Reverted.`);
    }
  };

  // W-1 fix: Reset all overrides to defaults
  const handleResetToDefaults = async () => {
    if (!state.activeShopId) return;

    const confirmed = await swalConfig.confirm(
      'Reset Feature Flags',
      'This will remove all custom overrides and revert every feature to its default state.',
      'Reset'
    );
    if (!confirmed.isConfirmed) return;

    try {
      // Delete all overrides for this shop
      await Promise.all(
        definitions.map(def =>
          shopFeaturesService.deleteFeature(state.activeShopId, def.key)
        )
      );

      // Rebuild flags from DB defaults
      const defaultFlags: Record<string, boolean> = {};
      for (const def of definitions) {
        defaultFlags[def.key] = def.defaultEnabled;
      }
      dispatch({ type: 'SET_FEATURE_FLAGS', payload: defaultFlags });
      swalConfig.success('Feature flags reset to defaults.');
    } catch (err) {
      console.error('Failed to reset feature flags:', err);
      swalConfig.error('Failed to reset feature flags. Some overrides may remain.');
    }
  };

  // W-3 fix: loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">Loading feature flags...</div>
      </div>
    );
  }

  // W-3 fix: error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-2xl">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5]">
          Feature Flags
        </h1>
        {/* W-1 fix: Reset to defaults button */}
        <button
          onClick={handleResetToDefaults}
          className="btn btn-secondary text-sm"
        >
          Reset to Defaults
        </button>
      </div>
      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat.key} className="bg-white dark:bg-[#2a1a10] rounded-2xl shadow-soft p-6">
            <h2 className={`text-lg font-semibold mb-4 ${cat.color}`}>{cat.label}</h2>
            <div className="space-y-3">
              {features.filter(f => f.category === cat.key).map(feature => (
                <div key={feature.key} className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[#473b32] dark:text-[#f0ece5]">{feature.name}</span>
                    {/* I-1 fix: Show description from DB */}
                    {feature.description && (
                      <p className="text-xs text-[#7d6b57] dark:text-[#c6bbab] mt-0.5">{feature.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggle(feature.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      featureFlags[feature.key] ? 'bg-[#9a693a]' : 'bg-[#ded7cc]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        featureFlags[feature.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
