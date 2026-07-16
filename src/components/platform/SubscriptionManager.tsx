import { useEffect, useState } from 'react';
import { platformAdminService, PlatformShop } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

export function SubscriptionManager() {
  const [shops, setShops] = useState<PlatformShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    setLoading(true);
    try {
      const data = await platformAdminService.listShops();
      setShops(data);
    } catch {
      swalConfig.error('Failed to load shops');
    }
    setLoading(false);
  }

  async function updateTier(shopId: string, newTier: 'free' | 'growth' | 'pro') {
    try {
      await platformAdminService.updateSubscription(shopId, newTier);
      setShops(shops.map(s => s.id === shopId ? { ...s, subscriptionTier: newTier } : s));
      swalConfig.success('Tier updated');
    } catch {
      swalConfig.error('Failed to update tier');
    }
  }

  if (loading) return <div className="text-center py-8">Loading shops…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100 mb-6">
        Subscription Management
      </h1>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Shop Name</th>
              <th className="table-header-cell">Status</th>
              <th className="table-header-cell">Current Tier</th>
              <th className="table-header-cell">Change To</th>
            </tr>
          </thead>
          <tbody>
            {shops.map(shop => (
              <tr key={shop.id} className="table-row">
                <td className="table-cell font-medium">{shop.name}</td>
                <td className="table-cell">
                  <span className={`badge ${shop.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {shop.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-cell">
                  <span className="badge badge-accent">{shop.subscriptionTier}</span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    {(['free', 'growth', 'pro'] as const).map(tier => (
                      <button
                        key={tier}
                        className={`btn btn-sm ${shop.subscriptionTier === tier ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => shop.subscriptionTier !== tier && updateTier(shop.id, tier)}
                        disabled={shop.subscriptionTier === tier}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
