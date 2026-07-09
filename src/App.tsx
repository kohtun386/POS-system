import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/SupabaseAppContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoadingSpinner } from './components/ui/LoadingComponents';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoginPage } from './components/auth/LoginPage';
import { PendingApprovalPage } from './components/auth/PendingApprovalPage';
import { Header } from './components/layout/Header';
import { PlatformLayout } from './components/platform/PlatformLayout';
import { useCapability } from './context/SupabaseAppContext';
// Lazy-loaded route components for code-splitting
const POSTerminal = lazy(() => import('./components/pos/POSTerminal').then(m => ({ default: m.POSTerminal })));
const TransactionsManager = lazy(() => import('./components/transactions/TransactionsManager').then(m => ({ default: m.TransactionsManager })));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager').then(m => ({ default: m.InventoryManager })));
const CustomerManager = lazy(() => import('./components/customers/CustomerManager').then(m => ({ default: m.CustomerManager })));
const ReportsManager = lazy(() => import('./components/reports/ReportsManager').then(m => ({ default: m.ReportsManager })));
const Settings = lazy(() => import('./components/settings/Settings').then(m => ({ default: m.Settings })));
const DiscountManager = lazy(() => import('./components/discounts/DiscountManager').then(m => ({ default: m.DiscountManager })));
const UserManager = lazy(() => import('./components/users/UserManager').then(m => ({ default: m.UserManager })));
const FeatureFlagsManager = lazy(() => import('./components/settings/FeatureFlagsManager').then(m => ({ default: m.FeatureFlagsManager })));
const AlertManager = lazy(() => import('./components/alerts/AlertManager').then(m => ({ default: m.AlertManager })));

function AppContent() {
  const { user, loading, profile, isPendingApproval } = useAuth();
  const { state } = useApp();
  const [currentView, setCurrentView] = useState('pos');
  const inventoryEnabled = useCapability('inventory');
  const customerEnabled = useCapability('customer_management');
  const discountEnabled = useCapability('discounts');

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

    // Restrict cashiers to POS only
    if (userRole === 'cashier' && currentView !== 'pos') {
      setCurrentView('pos');
      return <POSTerminal />;
    }

    switch (currentView) {
      case 'pos':
        return <POSTerminal />;
      case 'transactions':
        // Only allow admin and manager to access transactions
        if (userRole === 'admin' || userRole === 'manager') {
          return <TransactionsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'inventory':
        // Only allow admin and manager to access inventory (feature-gated)
        if ((userRole === 'admin' || userRole === 'manager') && inventoryEnabled) {
          return <InventoryManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'customers':
        // Only allow admin and manager to access customers (feature-gated)
        if ((userRole === 'admin' || userRole === 'manager') && customerEnabled) {
          return <CustomerManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'reports':
        // Only allow admin and manager to access reports
        if (userRole === 'admin' || userRole === 'manager') {
          return <ReportsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'discounts':
        // Only allow admin and manager to access discounts (feature-gated)
        if ((userRole === 'admin' || userRole === 'manager') && discountEnabled) {
          return <DiscountManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'users':
        // Only allow admin to access users
        if (userRole === 'admin') {
          return <UserManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'settings':
        // Only allow admin and manager to access settings
        if (userRole === 'admin' || userRole === 'manager') {
          return <Settings />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'alerts':
        // Only allow admin and manager to access alerts
        if (userRole === 'admin' || userRole === 'manager') {
          return <AlertManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      default:
        return <POSTerminal />;
    }
  };

  return (
    <div className="h-dvh bg-[#faf8f5] dark:bg-[#1f1309] flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header currentView={currentView} onViewChange={setCurrentView} />
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
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <CurrencyProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </CurrencyProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;