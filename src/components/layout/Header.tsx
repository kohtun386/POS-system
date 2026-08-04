import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  User, Settings, ShoppingCart, Monitor, Smartphone, Bell, Menu, X, Percent,
  Receipt, Package, Users, BarChart3, Sun, Moon, ClipboardList, Layers,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import { useCapability } from '../../hooks/useCapability';
import { useTheme } from '../../hooks/useTheme';
interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Header({ currentView, onViewChange }: HeaderProps) {
  const { state, dispatch } = useApp();
  const { isDark, toggleTheme } = useTheme();
  
  const inventoryEnabled = useCapability('inventory');
  const customerEnabled = useCapability('customer_management');
  const discountEnabled = useCapability('discounts');
  const purchaseLogEnabled = useCapability('purchase_log');
  const stockOverviewEnabled = useCapability('stock_overview');
  
  const [navScrollRef, setNavScrollRef] = useState<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // Effect for scroll detection and click outside for mobile menu
  useEffect(() => {
    const handleScroll = () => {
      if (navScrollRef) {
        setCanScrollLeft(navScrollRef.scrollLeft > 0);
        setCanScrollRight(navScrollRef.scrollLeft < navScrollRef.scrollWidth - navScrollRef.clientWidth);
        // Hide arrows if fully scrolled
        if (navScrollRef.scrollLeft === 0) setCanScrollLeft(false);
        if (navScrollRef.scrollLeft >= navScrollRef.scrollWidth - navScrollRef.clientWidth - 1) setCanScrollRight(false);
      }
    };

    const handleClickOutside: EventListener = (event) => {
      const target = event.target as Element | null;
      const clickedMenuToggle = target?.closest('button[aria-label="Open menu"], button[aria-label="Close menu"]');
      const clickedInsideMenu = mobileMenuRef.current?.contains(target);

      if (showMobileMenu && !clickedMenuToggle && !clickedInsideMenu) {
        setShowMobileMenu(false);
      }
    };

    if (navScrollRef) {
      navScrollRef.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }
    document.addEventListener('click', handleClickOutside, true);

    return () => {
      if (navScrollRef) {
        navScrollRef.removeEventListener('scroll', handleScroll);
      }
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [navScrollRef, showMobileMenu]);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef) {
      const scrollAmount = direction === 'left' ? -120 : 120;
      navScrollRef.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleNavItemClick = (itemId: string, source: 'desktop' | 'mobile', event?: ReactMouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    onViewChange(itemId);
    if (source === 'mobile') {
      setShowMobileMenu(false);
    }
  };

  const toggleInterfaceMode = () => {
    const newMode = state.settings.interfaceMode === 'touch' ? 'traditional' : 'touch';
    dispatch({ type: 'SET_SETTINGS', payload: { interfaceMode: newMode } });
  };

  const cartItemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  const getNavigationItems = () => {
    const role = state.currentUser?.role;
    const items = [];

    items.push({ id: 'pos', label: 'POS', icon: ShoppingCart, color: 'text-primary-600' });
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'transactions', label: 'Sales', icon: Receipt, color: 'text-success-500' });
    }
    if ((role === 'admin' || role === 'manager') && inventoryEnabled) {
      items.push({ id: 'inventory', label: 'Inventory', icon: Package, color: 'text-primary-600' });
    }
    if ((role === 'admin' || role === 'manager') && purchaseLogEnabled) {
      items.push({ id: 'purchase-log', label: 'Purchases', icon: ClipboardList, color: 'text-primary-600' });
    }
    if ((role === 'admin' || role === 'manager') && stockOverviewEnabled) {
      items.push({ id: 'stock-overview', label: 'Stock', icon: Layers, color: 'text-purple-600' });
    }
    if ((role === 'admin' || role === 'manager') && customerEnabled) {
      items.push({ id: 'customers', label: 'Customers', icon: Users, color: 'text-accent-500' });
    }
    if ((role === 'admin' || role === 'manager') && discountEnabled) {
      items.push({ id: 'discounts', label: 'Discounts', icon: Percent, color: 'text-accent-600' });
    }
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-primary-400' });
    }
    if (role === 'admin' || role === 'manager') {
      items.push({ id: 'alerts', label: 'Alerts', icon: Bell, color: 'text-accent-600' });
    }
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
                <img src={state.settings.storeLogo} alt="Store Logo" className="h-8 w-8 lg:h-10 lg:w-10 object-contain rounded-xl" />
              ) : (
                <div className="h-8 w-8 lg:h-10 lg:w-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-medium">
                  <ShoppingCart className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="text-lg lg:text-xl font-bold text-secondary-900 dark:text-secondary-100 truncate max-w-48 font-fraunces">
                  {state.settings.storeName}
                </h1>
                <p className="text-xs text-secondary-600 dark:text-secondary-300 hidden lg:block">CoffeeShop POS</p>
              </div>
            </div>

            {/* Tablet/Desktop Icon-Only Navigation with Tooltips */}
            <nav className="hidden md:flex items-center ml-4">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollNav('left')}
                  className="flex items-center justify-center w-10 h-10 rounded-2xl text-secondary-600 hover:text-primary-600 hover:bg-secondary-100/50 dark:hover:bg-primary-900/50 transition-all duration-200 touch-friendly flex-shrink-0 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  aria-label="Scroll navigation left"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              <div
                ref={setNavScrollRef}
                className="flex items-center overflow-x-auto scrollbar-hide scroll-smooth space-x-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavItemClick(item.id, 'desktop')}
                    className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 touch-friendly flex-shrink-0 group ${
                      currentView === item.id
                        ? 'bg-primary-50 text-primary-700 shadow-soft dark:bg-primary-900/50 dark:text-primary-300'
                        : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-primary-900/50'
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <item.icon className={`h-5 w-5 ${currentView === item.id ? 'text-primary-600' : item.color}`} />
                    
                    {/* Custom Tooltip on Hover/Focus */}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-secondary-900 dark:bg-secondary-800 rounded shadow-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                      {item.label}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-secondary-900 dark:border-t-secondary-800"></span>
                    </span>
                  </button>
                ))}
              </div>

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollNav('right')}
                  className="flex items-center justify-center w-10 h-10 rounded-2xl text-secondary-600 hover:text-primary-600 hover:bg-secondary-100/50 dark:hover:bg-primary-900/50 transition-all duration-200 touch-friendly flex-shrink-0 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  aria-label="Scroll navigation right"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </nav>
          </div>

          {/* Right Side Controls (Theme, Interface Mode, Cart, Notifications, User, Mobile Menu) */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            <button
              onClick={toggleTheme}
              className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-2xl bg-secondary-100/50 hover:bg-secondary-200/50 transition-all duration-300 text-sm font-medium"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? <Sun className="h-4 w-4 text-accent-500" /> : <Moon className="h-4 w-4 text-secondary-600" />}
              <span className="hidden lg:block text-secondary-900 dark:text-secondary-100">{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <button
              onClick={toggleInterfaceMode}
              className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-2xl bg-secondary-100/50 hover:bg-secondary-200/50 transition-all duration-300 text-sm font-medium"
              title={`Switch to ${state.settings.interfaceMode === 'touch' ? 'Traditional' : 'Touch'} Mode`}
              aria-label={`Switch to ${state.settings.interfaceMode === 'touch' ? 'traditional' : 'touch'} mode`}
            >
              {state.settings.interfaceMode === 'touch' ? <Monitor className="h-4 w-4 text-secondary-600" /> : <Smartphone className="h-4 w-4 text-secondary-600" />}
              <span className="hidden lg:block text-secondary-900 dark:text-secondary-100">{state.settings.interfaceMode === 'touch' ? 'Touch' : 'Traditional'}</span>
            </button>

            {currentView === 'pos' && cartItemCount > 0 && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-2xl bg-primary-50 text-primary-700 shadow-soft animate-pulse-gentle">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-semibold text-sm">{cartItemCount}</span>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold text-secondary-900 dark:text-secondary-100 truncate max-w-32">{state.currentUser?.name}</p>
                <p className="text-xs text-secondary-600 dark:text-secondary-300 capitalize">{state.currentUser?.role}</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 lg:h-9 lg:w-9 bg-gradient-to-br from-primary-600 to-accent-500 rounded-2xl flex items-center justify-center shadow-medium">
                  <User className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>

                <div className="hidden md:flex items-center space-x-1">
                  <button type="button" onClick={() => onViewChange('settings')} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300"
              aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div ref={mobileMenuRef} className="md:hidden border-t border-secondary-200/50 py-4 animate-slide-down">
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => handleNavItemClick(item.id, 'mobile', e)}
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
                <button type="button" onClick={(e) => { e.stopPropagation(); onViewChange('settings'); setShowMobileMenu(false); }} className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100/50 transition-all duration-300">
                  <Settings className="h-5 w-5 text-secondary-600" />
                  <span>Settings</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}