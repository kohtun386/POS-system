import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function PlatformDashboard() {
  useAuth(); // ensure auth context loaded
  const [stats, setStats] = useState({ pending: 0, active: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [shopsRes, membersRes] = await Promise.all([
          supabase.from('shops').select('id, is_active'),
          supabase.from('shop_memberships').select('id, is_active'),
        ]);
        const allShops = shopsRes.data || [];
        const allMembers = membersRes.data || [];
        const pending = allMembers.filter(m => !m.is_active).length;
        const active = allShops.filter(s => s.is_active).length;
        setStats({ pending, active, totalRevenue: 0 });
      } catch {
        // Stats best-effort — don't block dashboard
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#7d6b57] dark:text-[#c6bbab]">Loading platform data…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-[#473b32] dark:text-[#f0ece5] mb-6">
        Platform Administration
      </h1>
      <p className="text-[#7d6b57] dark:text-[#c6bbab] mb-8">
        Manage shops, subscriptions, and feature definitions across the platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-[#f57323]">{stats.pending}</div>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab] mt-1">Pending Approvals</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-[#9a693a]">{stats.active}</div>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab] mt-1">Active Shops</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-[#473b32] dark:text-[#f0ece5]">${stats.totalRevenue}</div>
          <div className="text-sm text-[#7d6b57] dark:text-[#c6bbab] mt-1">Total Revenue</div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-fraunces font-semibold text-[#473b32] dark:text-[#f0ece5] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <button
            className="btn btn-primary"
            onClick={() => {/* will route to pending shops */}}
          >
            Review Pending Shops
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {/* will route to feature management */}}
          >
            Manage Features
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {/* will route to shop list */}}
          >
            View All Shops
          </button>
        </div>
      </div>
    </div>
  );
}
