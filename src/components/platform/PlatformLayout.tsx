import { useState } from 'react';
import { PlatformDashboard } from './PlatformDashboard';
import { PendingShopsList } from './PendingShopsList';
import { SubscriptionManager } from './SubscriptionManager';
import { FeatureDefinitions } from './FeatureDefinitions';

type PlatformView = 'dashboard' | 'pending' | 'subscriptions' | 'features';

export function PlatformLayout() {
  const [view, setView] = useState<PlatformView>('dashboard');

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'pending', label: 'Pending Shops', icon: '⏳' },
    { key: 'subscriptions', label: 'Subscriptions', icon: '💳' },
    { key: 'features', label: 'Features', icon: '⚙️' },
  ] as const;

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <PlatformDashboard />;
      case 'pending':
        return <PendingShopsList />;
      case 'subscriptions':
        return <SubscriptionManager />;
      case 'features':
        return <FeatureDefinitions />;
      default:
        return <PlatformDashboard />;
    }
  };

  return (
    <div className="h-dvh bg-secondary-50 dark:bg-primary-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary-100 dark:bg-[#2a1f15] border-r border-secondary-200 dark:border-[#3d2d1f] p-4">
        <h1 className="text-xl font-fraunces font-bold text-primary-600 mb-6">
          Platform Admin
        </h1>
        <nav className="space-y-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key as PlatformView)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                view === item.key
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-900 dark:text-secondary-100 hover:bg-secondary-200 dark:hover:bg-[#3d2d1f]'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}