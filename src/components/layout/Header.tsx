import { useState, useEffect } from 'react';
import {
  User, Settings, LogOut, ShoppingCart, Monitor, Smartphone, Bell, Menu, X, Percent,
  Receipt, Package, Users, BarChart3, Sun, Moon, ClipboardList, Layers
} from 'lucide-react';
import { useApp, useCapability } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { swalConfig } from '../../lib/sweetAlert';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Header({ currentView, onViewChange }: HeaderProps) {
  const { state, dispatch } = useApp();
  const { signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const inventoryEnabled = useCapability('inventory');
  const customerEnabled = useCapability('customer_management');
  const discountEnabled = useCapability('discounts');
  const purchaseLogEnabled = useCapability('purchase_log');
  const stockOverviewEnabled = useCapability('stock_overview');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleInterfaceMode = () => {
    const newMode = state.settings.interfaceMode === 'touch' ? 'traditional' : 'touch';
    dispatch({ type: 'SET_SETTINGS', payload: { interfaceMode: newMode } });
  };

  const handleLogout = async () => {
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

  const cartItemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  // Role-based navigation with proper permissions
  const getNavigationItems = () => {
    const role = state.currentUser?.role;
    const items = [];

    // POS - All roles can access on tablet/desktop. On mobile, only cashiers.
    if (!isMobile || role === 'cashier') {
      items.push({ id: 'pos', label: 'POS', icon: ShoppingCart, color: 'text-primary-600' });
    }

    // Sales/Transactions - Manager and Admin only (Cashiers should only have POS access)
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'transactions', label: 'Sales', icon: Receipt, color: 'text-success-500' });
    }

    // Inventory - Manager and Admin can access (feature-gated)
    if ((role === 'admin' || role === 'manager') && inventoryEnabled) {
      items.push({ id: 'inventory', label: 'Inventory', icon: Package, color: 'text-primary-600' });
    }

    // Purchase Log - Manager and Admin can access (Growth+ feature-gated)
    if ((role === 'admin' || role === 'manager') && purchaseLogEnabled) {
      items.push({ id: 'purchase-log', label: 'Purchases', icon: ClipboardList, color: 'text-blue-600' });
    }

    // Stock Overview - Manager and Admin can access (Growth+ feature-gated)
    if ((role === 'admin' || role === 'manager') && stockOverviewEnabled) {
      items.push({ id: 'stock-overview', label: 'Stock', icon: Layers, color: 'text-purple-600' });
    }

    // Customers - Manager and Admin can access (feature-gated)
    if ((role === 'admin' || role === 'manager') && customerEnabled) {
      items.push({ id: 'customers', label: 'Customers', icon: Users, color: 'text-accent-500' });
    }

    // Discounts - Manager and Admin can access (feature-gated)
    if ((role === 'admin' || role === 'manager') && discountEnabled) {
      items.push({ id: 'discounts', label: 'Discounts', icon: Percent, color: 'text-accent-600' });
    }

    // Reports - Manager and Admin can access
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-primary-400' });
    }

    // Alerts - Manager and Admin can access
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'alerts', label: 'Alerts', icon: Bell, color: 'text-accent-600' });
    }

    // Users - Admin only
    if (role === 'admin') {
      items.push({ id: 'users', label: 'Users', icon: User, color: 'text-primary-700' });
    }

    return items;
  };

  const navigationItems = getNavigationItems();

  return (
    <header className="bg-secondary-50/80 backdrop-blur-md border-b border-secondary-200/50 dark:bg-surface-dark/80 dark:border-secondary-800/50 sticky top-0 z-40 shadow-soft">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo and Store Name */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {state.settings.storeLogo ? (
                <img
                  src={state.settings.storeLogo}
                  alt="Store Logo"
                  className="h-8 w-8 lg:h-10 lg:w-10 object-contain rounded-lg"
                />
              ) : (
                <div className="h-8 w-8 lg:h-10 lg:w-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-medium">
                  <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="text-lg lg:text-xl font-bold text-secondary-900 dark:text-secondary-100 truncate max-w-48">
                  {state.settings.storeName}
                </h1>
                <p className="text-xs text-secondary-600 dark:text-secondary-300 hidden lg:block">CoffeeShop POS</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex space-x-1 ml-8">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    currentView === item.id
                      ? 'bg-primary-50 text-primary-700 shadow-soft dark:bg-primary-900/50 dark:text-primary-300'
                      : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-primary-900/50'
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${currentView === item.id ? 'text-primary-600' : item.color}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-2xl bg-secondary-100/50 hover:bg-hover-border/50 transition-all duration-300 text-sm font-medium"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-accent-500" />
              ) : (
                <Moon className="h-4 w-4 text-secondary-600" />
              )}
              <span className="hidden lg:block text-secondary-900 dark:text-secondary-100">
                {isDark ? 'Light' : 'Dark'}
              </span>
            </button>

            {/* Interface Mode Toggle - Hidden on mobile */}
            <button
              onClick={toggleInterfaceMode}
              className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-2xl bg-secondary-100/50 hover:bg-hover-border/50 transition-all duration-300 text-sm font-medium"
              title={`Switch to ${state.settings.interfaceMode === 'touch' ? 'Traditional' : 'Touch'} Mode`}
              aria-label={`Switch to ${state.settings.interfaceMode === 'touch' ? 'traditional' : 'touch'} mode`}
            >
              {state.settings.interfaceMode === 'touch' ? (
                <Monitor className="h-4 w-4 text-secondary-600" />
              ) : (
                <Smartphone className="h-4 w-4 text-secondary-600" />
              )}
              <span className="hidden lg:block text-secondary-900 dark:text-secondary-100">
                {state.settings.interfaceMode === 'touch' ? 'Touch' : 'Traditional'}
              </span>
            </button>

            {/* Cart Indicator */}
            {currentView === 'pos' && cartItemCount > 0 && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-2xl bg-primary-50 text-primary-700 shadow-soft animate-pulse-gentle">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold text-sm">{cartItemCount}</span>
              </div>
            )}

            {/* Notifications */}
            <button className="btn-ghost p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl transition-all duration-300 relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-accent-600 rounded-full animate-pulse"></span>
            </button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold text-secondary-900 dark:text-secondary-100 truncate max-w-32">
                  {state.currentUser?.name}
                </p>
                <p className="text-xs text-secondary-600 dark:text-secondary-300 capitalize">
                  {state.currentUser?.role}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 lg:h-9 lg:w-9 bg-gradient-to-br from-primary-600 to-accent-500 rounded-2xl flex items-center justify-center shadow-medium">
                  <User className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>

                <div className="hidden md:flex items-center space-x-1">
                  <button
                    onClick={() => onViewChange('settings')}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300"
                    aria-label="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>

                  <button
                    onClick={handleLogout}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-secondary-600 hover:text-danger-600 hover:bg-[#fee2e2] transition-all duration-300"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="xl:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300"
              aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="xl:hidden border-t border-secondary-200/50 py-4 animate-slide-down">
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    currentView === item.id
                      ? 'bg-primary-50 text-primary-700 shadow-soft'
                      : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${currentView === item.id ? 'text-primary-600' : item.color}`} />
                  <span>{item.label}</span>
                </button>
              ))}

              <div className="border-t border-secondary-200/50 pt-4 mt-4 space-y-2">
                <button
                  onClick={() => {
                    onViewChange('settings');
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300"
                >
                  <Settings className="h-5 w-5 text-secondary-600" />
                  <span>Settings</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold text-danger-600 hover:bg-[#fee2e2] transition-all duration-300"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
