import { useState } from 'react';
import { LayoutDashboard, Clock, CreditCard, Settings, Menu, X } from 'lucide-react';
import { PlatformDashboard } from './PlatformDashboard';
import { PendingShopsList } from './PendingShopsList';
import { SubscriptionManager } from './SubscriptionManager';
import { FeatureDefinitions } from './FeatureDefinitions';

type PlatformView = 'dashboard' | 'pending' | 'subscriptions' | 'features';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pending', label: 'Pending Shops', icon: Clock },
  { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { key: 'features', label: 'Features', icon: Settings },
] as const;

export function PlatformLayout() {
  const [view, setView] = useState<PlatformView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNav = (key: PlatformView) => {
    setView(key);
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (view) {
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
    <div className="h-dvh bg-secondary-50 dark:bg-primary-950 flex flex-col">
      {/* Mobile Header */}
      <header className="h-12 flex items-center px-4 bg-secondary-100 dark:bg-surface-dark border-b border-secondary-200 dark:border-secondary-800 md:hidden">
        <button
          className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-800 transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="ml-3 text-lg font-fraunces font-bold text-primary-600">Platform Admin</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-secondary-950/40 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — desktop: always visible; mobile: slide-in overlay */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-40
            w-64 bg-secondary-100 dark:bg-surface-dark border-r border-secondary-200 dark:border-secondary-800
            flex flex-col pt-4 pb-4
            transition-transform duration-200 ease-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0
          `}
        >
          <h1 className="text-xl font-fraunces font-bold text-primary-600 mb-6 px-4 hidden md:block">
            Platform Admin
          </h1>
          <nav className="space-y-1 px-3">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.key as PlatformView)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    view === item.key
                      ? 'bg-primary-600 text-white'
                      : 'text-secondary-900 dark:text-secondary-100 hover:bg-secondary-200 dark:hover:bg-secondary-800'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
