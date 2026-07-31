import { useState } from 'react';
import { LayoutDashboard, Clock, CreditCard, User, Sun, Moon, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { swalConfig } from '../../lib/sweetAlert';
import { PlatformDashboard } from './PlatformDashboard';
import { PendingShopsList } from './PendingShopsList';
import { SubscriptionManager } from './SubscriptionManager';

type PlatformView = 'dashboard' | 'pending' | 'subscriptions';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pending', label: 'Pending Shops', icon: Clock },
  { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
] as const;

export function PlatformLayout() {
  const [view, setView] = useState<PlatformView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleNav = (key: PlatformView) => {
    setView(key);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    const result = await swalConfig.confirm(
      'Sign Out Confirmation',
      'Are you sure you want to sign out? You will be logged out of the system.',
      'Sign Out'
    );
    if (result.isConfirmed) {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
        swalConfig.error('Failed to sign out. Please try again.');
      }
    }
  };

  const renderView = () => {
    switch (view) {
      case 'pending':
        return <PendingShopsList />;
      case 'subscriptions':
        return <SubscriptionManager />;
      default:
        return <PlatformDashboard />;
    }
  };

  return (
    <div className="h-dvh bg-secondary-50 dark:bg-primary-950 flex flex-col">
      {/* Mobile Header */}
      <header className="h-12 flex items-center px-4 bg-secondary-100 dark:bg-surface-dark border-b border-secondary-200 dark:border-secondary-800 md:hidden">
        <button
          className="p-3 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-secondary-200 dark:hover:bg-secondary-800 transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span className="ml-3 text-lg font-fraunces font-bold text-primary-600">Platform Admin</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-secondary-700 dark:text-secondary-300">{profile?.name}</span>
          <button
            onClick={handleSignOut}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-secondary-600 hover:text-red-600 hover:bg-secondary-200 dark:hover:bg-secondary-800 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
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
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
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

          {/* User profile + controls */}
          <div className="mt-auto px-3 pt-4 border-t border-secondary-200 dark:border-secondary-800">
            <div className="flex items-center gap-3 px-4 py-2 mb-2">
              <div className="h-8 w-8 bg-gradient-to-br from-primary-600 to-accent-500 rounded-xl flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-secondary-900 dark:text-secondary-100 truncate">{profile?.name}</div>
                <div className="text-xs text-secondary-500 dark:text-secondary-400 capitalize">{profile?.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2">
              <button
                onClick={toggleTheme}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-secondary-700 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-800 transition-colors text-sm"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-secondary-700 dark:text-secondary-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors text-sm"
                aria-label="Sign out"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
