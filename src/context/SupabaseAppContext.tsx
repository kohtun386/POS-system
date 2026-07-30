import React, { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import {
  Product, Customer, Sale, User, Discount, CartItem, AppSettings, SalesTab, DiscountCondition, Shop,
  CashShift
} from '../types';
import { useAuth } from './AuthContext';
import {
  productsService,
  customersService,
  salesService,
  discountsService,
  settingsService,
  usersService,
  salesTabsService,
  shopMembershipsService,
  shopFeaturesService,
  cashShiftsService,
  resolveCapabilitiesRpc
} from '../lib/services';
import { appReducer, initialState } from './reducers';
import type { AppState, AppAction } from './reducers';

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

const CART_STORAGE_KEY = 'coffeepos_cart';

function loadPersistedCart(): { cart: CartItem[]; selectedCustomer: Customer | null } | null {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.cart)) {
      return {
        cart: parsed.cart,
        selectedCustomer: parsed.selectedCustomer || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function persistCart(cart: CartItem[], selectedCustomer: Customer | null) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ cart, selectedCustomer }));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, profile } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const cartRestored = useRef(false);

  // Restore cart from localStorage on mount (before Supabase load)
  useEffect(() => {
    if (!cartRestored.current) {
      const persisted = loadPersistedCart();
      if (persisted && persisted.cart.length > 0) {
        dispatch({ type: 'SET_CART', payload: persisted.cart });
      }
      if (persisted && persisted.selectedCustomer) {
        dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: persisted.selectedCustomer });
      }
      cartRestored.current = true;
    }
  }, []);

  // Persist cart to localStorage on every change (skip during initial data load)
  useEffect(() => {
    if (cartRestored.current) {
      persistCart(state.cart, state.selectedCustomer);
    }
  }, [state.cart, state.selectedCustomer]);

  // Load data from Supabase when user is authenticated
  useEffect(() => {
    if (user && profile && !initialized) {
      loadData();
      setInitialized(true);
    } else if (!user) {
      // Reset state when user logs out
      dispatch({ type: 'SET_PRODUCTS', payload: [] });
      dispatch({ type: 'SET_CUSTOMERS', payload: [] });
      dispatch({ type: 'SET_SALES', payload: [] });
      dispatch({ type: 'SET_USERS', payload: [] });
      dispatch({ type: 'SET_DISCOUNTS', payload: [] });
      dispatch({ type: 'SET_SALES_TABS', payload: [] });
      dispatch({ type: 'CLEAR_CART' });
      dispatch({ type: 'SET_CURRENT_USER', payload: null });
      dispatch({ type: 'SET_ACTIVE_SHOP', payload: '' });
      setInitialized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, initialized]);

  // Set current user from auth profile
  useEffect(() => {
    if (profile) {
      dispatch({ type: 'SET_CURRENT_USER', payload: profile });
    }
  }, [profile]);

  async function loadData() {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // VISION.md §17.4: Platform admins use Edge Functions, not direct DB access.
      // Skip ALL shop-specific data loading for platform_admin role.
      // Platform dashboard uses platformAdminService (Edge Functions) exclusively.
      if (profile?.role === 'platform_admin') {
        dispatch({ type: 'SET_ERROR', payload: null });
        return;
      }

      // Load shop FIRST — needed for defense-in-depth shop_id filtering
      const shop = user ? await shopMembershipsService.getShopByUserId(user.id) : null;
      const shopId = shop?.id;

      // Set active shop immediately
      if (shop) {
        dispatch({ type: 'SET_SHOP', payload: shop });
        dispatch({ type: 'SET_ACTIVE_SHOP', payload: shop.id });
      }

      // Load data in parallel with shop_id for defense-in-depth filtering
      let products: Product[] = [];
      let customers: Customer[] = [];
      let sales: Sale[] = [];
      let discounts: Discount[] = [];
      let settings: AppSettings = initialState.settings;
      let users: User[] = [];
      let salesTabs: SalesTab[] = [];

      try {
        [
          products,
          customers,
          sales,
          discounts,
          settings,
          users,
          salesTabs,
        ] = await Promise.all([
          productsService.getAll(shopId),
          customersService.getAll(shopId),
          salesService.getAll({ shopId }).then(r => r.data),
          discountsService.getAll(shopId),
          settingsService.get(shopId),
          usersService.getAll(),
          user ? salesTabsService.getByUserId(user.id) : Promise.resolve([]),
        ]);
        console.log('✓ Data loaded — products:', products.length, 'customers:', customers.length, 'sales:', sales.length);
      } catch (dataError) {
        console.warn('Some data failed to load (partial state may be empty):', dataError);
        // Non-fatal — capabilities and cash shifts still attempt below.
        // Individual services can still be loaded on retry via component-level refetches.
      }

      dispatch({ type: 'SET_PRODUCTS', payload: products });
      dispatch({ type: 'SET_CUSTOMERS', payload: customers });
      dispatch({ type: 'SET_SALES', payload: sales });
      dispatch({ type: 'SET_DISCOUNTS', payload: discounts });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      dispatch({ type: 'SET_USERS', payload: users });
      dispatch({ type: 'SET_SALES_TABS', payload: salesTabs });

      // Resolve capabilities (VISION §5) — server-side via RPC.
      // Isolated in its own try/catch so capabilities always attempt to resolve,
      // even if the main data load above failed.
      try {
        if (shop) {
          const caps = await resolveCapabilitiesRpc(shop.id);
          dispatch({ type: 'SET_CAPABILITIES', payload: caps });
          console.log('✓ Capabilities resolved:', caps.length);
        }
      } catch (capsError) {
        console.warn('Failed to resolve capabilities:', capsError);
      }

      // Cash shifts + shop features (non-critical, isolated from core data)
      try {
        const [, latestCashShifts] = await Promise.all([
          shop ? shopFeaturesService.getByShopId(shop.id) : Promise.resolve([]),
          shop ? cashShiftsService.getByShopId(shop.id, 1) : Promise.resolve([]),
        ]);
        dispatch({ type: 'SET_CASH_SHIFTS', payload: latestCashShifts });
      } catch (shiftError) {
        console.warn('Failed to load cash shifts/shop features:', shiftError);
      }

      // Create initial sales tab if none exist
      if (salesTabs.length === 0 && user) {
        try {
          const initialTab: Omit<SalesTab, 'id' | 'createdAt'> = {
            name: 'Sale 1',
            cart: [],
            selectedCustomer: null,
          };
          const newTab = await salesTabsService.create(user.id, initialTab, shop?.id);
          dispatch({ type: 'ADD_SALES_TAB', payload: newTab });
        } catch (tabError) {
          console.warn('Failed to create initial sales tab:', tabError);
        }
      }

      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: unknown) {
      console.error('Error loading data:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  // Expose dispatch globally for E2E tests to set capabilities without page reload
  if (typeof window !== 'undefined') {
    window.__appDispatch = dispatch;
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

/**
 * Check if the current shop has a specific capability.
 * Replaces the old `useFeatureFlag()` hook pattern.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCapability(name: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(name);
}

// Utility function to check if discounts apply
// eslint-disable-next-line react-refresh/only-export-components
export function checkDiscountEligibility(
  discount: Discount,
  cart: CartItem[],
  customer: Customer | null,
  paymentMethod: string,
  total: number,
  cardDetails?: { cardType?: string; bankName?: string }
): boolean {
  // Check if discount is active and within valid period
  if (!discount.active) return false;

  const now = new Date();
  if (now < discount.validFrom || now > discount.validTo) return false;

  // Check valid days
  if (discount.validDays && discount.validDays.length > 0) {
    const currentDay = now.getDay();
    if (!discount.validDays.includes(currentDay)) return false;
  }

  // Check conditions
  if (Array.isArray(discount.conditions)) {
    for (const condition of discount.conditions) {
      if (!checkCondition(condition, cart, customer, paymentMethod, total, cardDetails)) {
        return false;
      }
    }
  }

  return true;
}

function checkCondition(
  condition: DiscountCondition,
  cart: CartItem[],
  customer: Customer | null,
  paymentMethod: string,
  total: number,
  cardDetails?: { cardType?: string; bankName?: string }
): boolean {
  switch (condition.type) {
    case 'min_amount':
      return total >= condition.value;

    case 'specific_products': {
      if (!Array.isArray(condition.value)) return false;
      const requiredProducts = condition.value as string[];
      const minQuantity = condition.minQuantity || 1;

      for (const productId of requiredProducts) {
        const cartItem = cart.find(item => item.product.id === productId);
        if (!cartItem || cartItem.quantity < minQuantity) {
          return false;
        }
      }
      return true;
    }

    case 'payment_method':
      return paymentMethod === condition.value;

    case 'customer_tier':
      return customer?.priceTier === condition.value;

    case 'card_type':
      return paymentMethod === 'card' && cardDetails?.cardType === condition.value;

    case 'bank_name':
      return paymentMethod === 'card' && cardDetails?.bankName === condition.value;

    default:
      return true;
  }
}

// Generate invoice number utility
// eslint-disable-next-line react-refresh/only-export-components
export function getNextInvoiceNumber(settings: AppSettings): string {
  const nextCounter = settings.invoiceCounter + 1;
  return `${settings.invoicePrefix}-${nextCounter.toString().padStart(6, '0')}`;
}

// Generate next invoice number and return data for updating settings
// eslint-disable-next-line react-refresh/only-export-components
export function generateNextInvoiceNumber(settings: AppSettings): { invoiceNumber: string; newCounter: number } {
  const newCounter = settings.invoiceCounter + 1;
  const invoiceNumber = `${settings.invoicePrefix}-${newCounter.toString().padStart(6, '0')}`;
  return { invoiceNumber, newCounter };
}

// DEPRECATED: Invoice numbers are now generated server-side by checkout_complete RPC.
// This hook is kept for test compatibility only — do NOT use in production code.
// eslint-disable-next-line react-refresh/only-export-components
export function useInvoiceGeneration() {
  const { state } = useApp();

  return async () => {
    const { invoiceNumber } = generateNextInvoiceNumber(state.settings);
    return invoiceNumber;
  };
}

// Utility functions for invoice counter management
// eslint-disable-next-line react-refresh/only-export-components
export function resetInvoiceCounter(dispatch: React.Dispatch<AppAction>, newCounter: number = 0) {
  dispatch({ type: 'INCREMENT_INVOICE_COUNTER', payload: newCounter });
}

// eslint-disable-next-line react-refresh/only-export-components
export function setInvoicePrefix(dispatch: React.Dispatch<AppAction>, prefix: string) {
  dispatch({ type: 'SET_SETTINGS', payload: { invoicePrefix: prefix } });
}

// Hook for invoice statistics
// eslint-disable-next-line react-refresh/only-export-components
export function useInvoiceStats() {
  const { state } = useApp();

  return () => {
    const totalInvoices = state.sales.length;
    const currentCounter = state.settings.invoiceCounter;
    const prefix = state.settings.invoicePrefix;
    const nextInvoiceNumber = getNextInvoiceNumber(state.settings);

    return {
      totalInvoices,
      currentCounter,
      prefix,
      nextInvoiceNumber,
    };
  };
}

// Multi-tenant utility: get active shop ID
// Currently returns the user's first active shop from shop_memberships.
// When multi-shop UI is built, this will return the user-selected shop.
// eslint-disable-next-line react-refresh/only-export-components
export function getActiveShopId(state: AppState): string {
  return state.activeShopId;
}

// Multi-tenant utility: for future service layer injection
// Services can call this to get the current shop_id for explicit queries.
// For now, RLS + DEFAULT handles scoping — this is for future use.
// eslint-disable-next-line react-refresh/only-export-components
export function useActiveShopId(): string {
  const { state } = useApp();
  return state.activeShopId;
}
