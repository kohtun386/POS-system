import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
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
    const { data, error } = await supabase
      .from('shop_memberships')
      .select(`
        shop_id, user_id, is_active, created_at,
        shops!shop_memberships_shop_id_fkey ( name ),
        users!shop_memberships_user_id_fkey ( name, email )
      `)
      .eq('is_active', false)
      .order('created_at', { ascending: false });
    if (error) {
      swalConfig.error('Failed to load pending shops');
      setLoading(false);
      return;
    }
    interface MembershipRow {
      shop_id: string;
      user_id: string;
      created_at: string;
      shops?: { name: string };
      users?: { name: string; email: string };
    }
    const items: PendingShop[] = ((data || []) as MembershipRow[]).map((row) => ({
      shopId: row.shop_id,
      shopName: row.shops?.name || 'Unknown',
      userId: row.user_id,
      userName: row.users?.name || 'Unknown',
      email: row.users?.email || '',
      createdAt: row.created_at,
    }));
    setPending(items);
    setLoading(false);
  }

  async function handleApprove(shopId: string, userId: string) {
    const result = await swalConfig.confirm('Approve this shop and activate the user?');
    if (!result.isConfirmed) return;
    const { error } = await supabase.rpc('platform_admin_approve_shop', {
      p_shop_id: shopId,
      p_user_id: userId,
    });
    if (error) {
      // Fallback to direct update if RPC not yet deployed
      const [memErr, userErr] = await Promise.all([
        supabase.from('shop_memberships').update({ is_active: true }).eq('shop_id', shopId).eq('user_id', userId),
        supabase.from('users').update({ active: true }).eq('id', userId),
      ]);
      if (memErr.error || userErr.error) {
        swalConfig.error('Failed to approve shop');
        return;
      }
      await supabase.from('shops').update({ is_active: true }).eq('id', shopId);
    }
    swalConfig.success('Shop approved');
    loadPending();
  }

  async function handleReject(shopId: string, userId: string) {
    const { value: reason } = await swalConfig.prompt('Rejection reason');
    if (!reason) return;
    const [memErr, userErr] = await Promise.all([
      supabase.from('shop_memberships').update({ is_active: false }).eq('shop_id', shopId).eq('user_id', userId),
      supabase.from('users').update({ active: false }).eq('id', userId),
    ]);
    if (memErr.error || userErr.error) {
      swalConfig.error('Failed to reject shop');
      return;
    }
    swalConfig.success('Shop rejected');
    loadPending();
  }

  if (loading) {
    return <div className="text-center py-8">Loading pending shops…</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-[#473b32] dark:text-[#f0ece5] mb-6">
        Pending Shop Approvals
      </h1>
      {pending.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[#7d6b57] dark:text-[#c6bbab]">No shops pending approval.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((shop) => (
            <div key={shop.shopId} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#473b32] dark:text-[#f0ece5]">{shop.shopName}</div>
                <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab]">
                  Owner: {shop.userName} ({shop.email})
                </div>
                <div className="text-xs text-[#a8978a] dark:text-[#8a7d70]">
                  Registered: {new Date(shop.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleApprove(shop.shopId, shop.userId)}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleReject(shop.shopId, shop.userId)}
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
