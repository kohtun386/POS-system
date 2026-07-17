import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { platformAdminService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

interface ShopInfo {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
}

export function ShopDetail() {
  const { shopId } = useParams<{ shopId: string }>();
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [stats, setStats] = useState({ salesCount: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shopId) loadShop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  async function loadShop() {
    if (!shopId) return;
    setLoading(true);
    try {
      const detail = await platformAdminService.getShopDetail(shopId);
      setShop(detail.shop as unknown as ShopInfo);
      setStats(detail.stats);
    } catch {
      swalConfig.error('Failed to load shop details');
    }
    setLoading(false);
  }

  async function updateTier(tier: string) {
    if (!shop) return;
    try {
      await platformAdminService.updateSubscription(shop.id, tier as 'free' | 'growth' | 'pro');
      setShop({ ...shop, subscription_tier: tier });
      swalConfig.success('Subscription updated');
    } catch {
      swalConfig.error('Failed to update subscription');
    }
  }

  async function toggleActive() {
    if (!shop) return;
    const newActive = !shop.is_active;
    try {
      await platformAdminService.toggleShopActive(shop.id, newActive);
      setShop({ ...shop, is_active: newActive });
      swalConfig.success(newActive ? 'Shop activated' : 'Shop deactivated');
    } catch {
      swalConfig.error('Failed to update status');
    }
  }

  if (loading) return <div className="text-center py-8">Loading shop details…</div>;
  if (!shop) return <div className="text-center py-8">Shop not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => window.history.back()}>
          ← Back
        </button>
        <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100">
          {shop.name}
        </h1>
        <span className={`badge ${shop.is_active ? 'badge-success' : 'badge-danger'}`}>
          {shop.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-100">Details</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-secondary-600">Address:</span> {shop.address}</div>
            <div><span className="text-secondary-600">Email:</span> {shop.email}</div>
            <div><span className="text-secondary-600">Phone:</span> {shop.phone}</div>
            <div><span className="text-secondary-600">Created:</span> {new Date(shop.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-100">Subscription</h2>
          <div className="flex items-center gap-2 mb-3">
            <span className="badge badge-accent">{shop.subscription_tier}</span>
          </div>
          <div className="flex gap-2">
            {['free', 'growth', 'pro'].map(tier => (
              <button
                key={tier}
                className={`btn btn-sm ${shop.subscription_tier === tier ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateTier(tier)}
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-100">Stats</h2>
          <div className="space-y-2">
            <div><span className="text-secondary-600">Total Sales:</span> {stats.salesCount}</div>
            <div><span className="text-secondary-600">Revenue:</span> {stats.totalRevenue.toLocaleString()} MMK</div>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-3 text-secondary-900 dark:text-secondary-100">Actions</h2>
          <button
            className={`btn ${shop.is_active ? 'btn-danger' : 'btn-success'}`}
            onClick={toggleActive}
          >
            {shop.is_active ? 'Deactivate Shop' : 'Activate Shop'}
          </button>
        </div>
      </div>
    </div>
  );
}
