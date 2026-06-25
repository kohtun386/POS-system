import { useApp } from '../../context/SupabaseAppContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlag';
import { shopFeaturesService } from '../../lib/services';

export function FeatureFlagsManager() {
  const { state, dispatch } = useApp();
  const featureFlags = useFeatureFlags();

  const categories = [
    { key: 'pos', label: 'POS', color: 'text-[#9a693a]' },
    { key: 'inventory', label: 'Inventory', color: 'text-[#22c55e]' },
    { key: 'customers', label: 'Customers', color: 'text-[#f57323]' },
    { key: 'general', label: 'General', color: 'text-[#7a4f2c]' },
    { key: 'kitchen', label: 'Kitchen', color: 'text-[#e55c13]' },
  ];

  const features = [
    { key: 'inventory_tracking', name: 'Inventory Tracking', category: 'inventory' },
    { key: 'batch_tracking', name: 'Batch Tracking', category: 'inventory' },
    { key: 'weight_based_products', name: 'Weight-Based Products', category: 'inventory' },
    { key: 'customer_management', name: 'Customer Management', category: 'customers' },
    { key: 'credit_system', name: 'Credit System', category: 'customers' },
    { key: 'discount_engine', name: 'Discount Engine', category: 'pos' },
    { key: 'multi_currency', name: 'Multi-Currency Support', category: 'general' },
    { key: 'draft_sales', name: 'Draft Sales', category: 'pos' },
    { key: 'multi_tab_sales', name: 'Multi-Tab Sales', category: 'pos' },
    { key: 'kitchen_display', name: 'Kitchen Display System', category: 'kitchen' },
    { key: 'online_ordering', name: 'Online Ordering', category: 'pos' },
    { key: 'advanced_reports', name: 'Advanced Reports', category: 'general' },
    { key: 'supplier_management', name: 'Supplier Management', category: 'inventory' },
  ];

  const handleToggle = async (key: string) => {
    const newValue = !featureFlags[key];
    dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: { key, enabled: newValue } });
    await shopFeaturesService.setFeature(state.activeShopId, key, newValue);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#473b32] dark:text-[#f0ece5] mb-6">
        Feature Flags
      </h1>
      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat.key} className="bg-white dark:bg-[#2a1a10] rounded-2xl shadow-soft p-6">
            <h2 className={`text-lg font-semibold mb-4 ${cat.color}`}>{cat.label}</h2>
            <div className="space-y-3">
              {features.filter(f => f.category === cat.key).map(feature => (
                <div key={feature.key} className="flex items-center justify-between">
                  <span className="text-sm text-[#473b32] dark:text-[#f0ece5]">{feature.name}</span>
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
