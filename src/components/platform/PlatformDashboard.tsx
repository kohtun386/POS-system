import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { platformAdminService, PlatformDailyStats } from '../../lib/services';
import { DEFAULT_CURRENCY } from '../../lib/constants';

export function PlatformDashboard() {
  useAuth();
  const [stats, setStats] = useState<PlatformDailyStats>({ totalShops: 0, activeShops: 0, pendingApprovals: 0, mrr: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await platformAdminService.dailyStats();
        setStats(data);
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
        <div className="text-secondary-600 dark:text-secondary-300">Loading platform data…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-fraunces font-bold text-secondary-900 dark:text-secondary-100 mb-6">
        Platform Administration
      </h1>
      <p className="text-secondary-600 dark:text-secondary-300 mb-8">
        Manage shops, subscriptions, and feature definitions across the platform.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat-card stat-card-warning">
          <div className="relative z-10">
            <div className="text-3xl font-bold">{stats.pendingApprovals}</div>
            <div className="text-sm opacity-90 mt-1">Pending Approvals</div>
          </div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="relative z-10">
            <div className="text-3xl font-bold">{stats.activeShops}</div>
            <div className="text-sm opacity-90 mt-1">Active Shops</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="relative z-10">
            <div className="text-3xl font-bold">
              {stats.mrr.toLocaleString()} {DEFAULT_CURRENCY}
            </div>
            <div className="text-sm opacity-90 mt-1">Monthly Recurring Revenue</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-fraunces font-semibold text-secondary-900 dark:text-secondary-100 mb-4">
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
