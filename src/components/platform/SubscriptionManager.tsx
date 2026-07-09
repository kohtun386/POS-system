import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { swalConfig } from '../../lib/sweetAlert';

interface Shop {
  id: string;
  name: string;
  subscription_tier: string;
  is_active: boolean;
}

export function SubscriptionManager() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('id, name, subscription_tier, is_active')
      .order('name');
    if (error) {
      swalConfig.error('Failed to load shops');
    } else {
      setShops(data || []);
    }
    setLoading(false);
  }

  async function updateTier(shopId: string, newTier: string) {
    const { error } = await supabase
      .from('shops')
      .update({ subscription_tier: newTier })
      .eq('id', shopId);
    if (error) {
      swalConfig.error('Failed to update tier');
      return;
    }
    setShops(shops.map(s => s.id === shopId ? { ...s, subscription_tier: newTier } : s));
    swalConfig.success('Tier updated');
  }

  if (loading) return <div className="text-center py-8">Loading shops…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-[#473b32] dark:text-[#f0ece5] mb-6">
        Subscription Management
      </h1>
      <div className="card overflow-hidden">
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
                  <span className={`badge ${shop.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {shop.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-cell">
                  <span className="badge badge-accent">{shop.subscription_tier}</span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    {(['free', 'growth', 'pro'] as const).map(tier => (
                      <button
                        key={tier}
                        className={`btn btn-sm ${shop.subscription_tier === tier ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => shop.subscription_tier !== tier && updateTier(shop.id, tier)}
                        disabled={shop.subscription_tier === tier}
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
  );
}