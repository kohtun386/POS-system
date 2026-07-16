import { useEffect, useState } from 'react';
import { platformAdminService, PlatformShop } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';

interface PendingShop {
  shopId: string;
  shopName: string;
  userId: string;
  userName: string;
  email: string;
  createdAt: string;
}

export function PendingShopsList() {
  const [pending, setPending] = useState<PendingShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    setLoading(true);
    try {
      const shops = await platformAdminService.listShops({ status: 'inactive' });
      const items: PendingShop[] = shops
        .filter((s) => !s.membershipActive)
        .map((s: PlatformShop) => ({
          shopId: s.id,
          shopName: s.name || 'Unknown',
          userId: (s as Record<string, unknown>).owner_id as string || '',
          userName: '',
          email: '',
          createdAt: s.createdAt || '',
        }));
      setPending(items);
    } catch {
      swalConfig.error('Failed to load pending shops');
    }
    setLoading(false);
  }

  async function handleApprove(shopId: string) {
    const result = await swalConfig.confirm('Approve this shop and activate the user?');
    if (!result.isConfirmed) return;
    try {
      await platformAdminService.approveShop(shopId);
      swalConfig.success('Shop approved');
      loadPending();
    } catch {
      swalConfig.error('Failed to approve shop');
    }
  }

  async function handleReject(shopId: string) {
    const { value: reason } = await swalConfig.prompt('Rejection reason');
    if (!reason) return;
    try {
      await platformAdminService.rejectShop(shopId, reason);
      swalConfig.success('Shop rejected');
      loadPending();
    } catch {
      swalConfig.error('Failed to reject shop');
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading pending shops…</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100 mb-6">
        Pending Shop Approvals
      </h1>
      {pending.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-secondary-600 dark:text-secondary-300">No shops pending approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((shop) => (
            <div key={shop.shopId} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-secondary-900 dark:text-secondary-100">{shop.shopName}</div>
                <div className="text-xs text-[#a8978a] dark:text-[#8a7d70]">
                  Registered: {new Date(shop.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleApprove(shop.shopId)}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleReject(shop.shopId)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
