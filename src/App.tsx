import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AppProvider } from './context/SupabaseAppContext';
import { useApp } from './hooks/useApp';
import { useCapability } from './hooks/useCapability';
import { ThemeProvider } from './context/ThemeContext';
import { LoadingSpinner } from './components/ui/LoadingComponents';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginPage } from './components/auth/LoginPage';
import { PendingApprovalPage } from './components/auth/PendingApprovalPage';
import { Header } from './components/layout/Header';
import { PlatformLayout } from './components/platform/PlatformLayout';
import { ReportsManager } from './lazyComponents';
import { Analytics } from '@vercel/analytics/react';
// Lazy-loaded route components for code-splitting
const POSTerminal = lazy(() => import('./components/pos/POSTerminal').then(m => ({ default: m.POSTerminal })));
const TransactionsManager = lazy(() => import('./components/transactions/TransactionsManager').then(m => ({ default: m.TransactionsManager })));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager').then(m => ({ default: m.InventoryManager })));
const CustomerManager = lazy(() => import('./components/customers/CustomerManager').then(m => ({ default: m.CustomerManager })));
const Settings = lazy(() => import('./components/settings/Settings').then(m => ({ default: m.Settings })));
const DiscountManager = lazy(() => import('./components/discounts/DiscountManager').then(m => ({ default: m.DiscountManager })));
const UserManager = lazy(() => import('./components/users/UserManager').then(m => ({ default: m.UserManager })));
const AlertManager = lazy(() => import('./components/alerts/AlertManager').then(m => ({ default: m.AlertManager })));
const PurchaseLogManager = lazy(() => import('./components/inventory/PurchaseLogManager').then(m => ({ default: m.PurchaseLogManager })));
const StockOverviewManager = lazy(() => import('./components/inventory/StockOverviewManager').then(m => ({ default: m.StockOverviewManager })));

function AppContent() {
  const { user, loading, profile, isPendingApproval } = useAuth();
  const { state } = useApp();
  const [currentView, setCurrentView] = useState('pos');
  const inventoryEnabled = useCapability('inventory');
  const customerEnabled = useCapability('customer_management');
  const discountEnabled = useCapability('discounts');
  const purchaseLogEnabled = useCapability('purchase_log');
  const stockOverviewEnabled = useCapability('stock_overview');

  const handleViewChange = (view: string) => {
    setCurrentView(view);
  };

  // Cashier redirect — runs AFTER render, not during it.
  // Previously this was inside renderCurrentView() calling setCurrentView
  // during render, which caused React to abandon the render and lock the
  // view to POS permanently when userRole was undefined (profile loading).
  useEffect(() => {
    const userRole = state.currentUser?.role;
    if (userRole === 'cashier' && currentView !== 'pos') {
      setCurrentView('pos');
    }
  }, [state.currentUser?.role, currentView]);

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-[#1f1309] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading CoffeeShop POS..." />
      </div>
    );
  }

  // Show login page if no user is authenticated
  if (!user || !state.currentUser) {
    return <LoginPage />;
  }

  // Platform admin sees dedicated layout — no POS, no shop context
  // Must check BEFORE isPendingApproval so platform admins are never
  // blocked by the approval gate.
  if (profile?.role === 'platform_admin') {
    return <PlatformLayout />;
  }

  // Show pending approval page if user's shop is not yet approved
  if (isPendingApproval) {
    return <PendingApprovalPage />;
  }

  const renderCurrentView = () => {
    const userRole = state.currentUser?.role;

    switch (currentView) {
      case 'pos':
        return <POSTerminal />;
      case 'transactions':
        if (userRole === 'admin' || userRole === 'manager') {
          return <TransactionsManager />;
        }
        return <POSTerminal />;
      case 'inventory':
        if ((userRole === 'admin' || userRole === 'manager') && inventoryEnabled) {
          return <InventoryManager />;
        }
        return <POSTerminal />;
      case 'purchase-log':
        if ((userRole === 'admin' || userRole === 'manager') && purchaseLogEnabled) {
          return <PurchaseLogManager />;
        }
        return <POSTerminal />;
      case 'stock-overview':
        if ((userRole === 'admin' || userRole === 'manager') && stockOverviewEnabled) {
          return <StockOverviewManager />;
        }
        return <POSTerminal />;
      case 'customers':
        if ((userRole === 'admin' || userRole === 'manager') && customerEnabled) {
          return <CustomerManager />;
        }
        return <POSTerminal />;
      case 'reports':
        if (userRole === 'admin' || userRole === 'manager') {
          return <ReportsManager />;
        }
        return <POSTerminal />;
      case 'discounts':
        if ((userRole === 'admin' || userRole === 'manager') && discountEnabled) {
          return <DiscountManager />;
        }
        return <POSTerminal />;
      case 'users':
        if (userRole === 'admin') {
          return <UserManager />;
        }
        return <POSTerminal />;
      case 'settings':
        if (userRole === 'admin' || userRole === 'manager') {
          return <Settings />;
        }
        return <POSTerminal />;
      case 'alerts':
        if (userRole === 'admin' || userRole === 'manager') {
          return <AlertManager />;
        }
        return <POSTerminal />;
      default:
        return <POSTerminal />;
    }
  };

  return (
    <div className="h-dvh bg-[#faf8f5] dark:bg-[#1f1309] flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {state.currentUser ? (
        <Header currentView={currentView} onViewChange={handleViewChange} />
      ) : (
        <div className="h-16 lg:h-20 bg-secondary-50/80" />
      )}
      <main id="main-content" className="flex-1 min-h-0 overflow-y-auto" role="main">
        {state.loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" text="Loading module..." />
            </div>
          }>
            <div className="animate-fade-in h-full">
              {renderCurrentView()}
            </div>
          </Suspense>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}

export default App;