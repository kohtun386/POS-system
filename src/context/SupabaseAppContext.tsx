import React, { createContext, useReducer, useEffect, useState, useRef } from 'react';
import {
  Product, Customer, Sale, User, Discount, CartItem, AppSettings, SalesTab
} from '../types';
import { useAuth } from '../hooks/useAuth';
import {
  productsService,
  customersService,
  salesService,
  discountsService,
  settingsService,
  usersService,
  salesTabsService,
  shopMembershipsService,
  cashShiftsService,
  resolveCapabilitiesRpc
} from '../lib/services';
import { appReducer, initialState } from './reducers';
import type { AppState, AppAction } from './reducers';
import { useShopRealtime } from '../hooks/useShopRealtime';

export const AppContext = createContext<{
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
          usersService.getAll(shopId),
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

      // Cash shifts (non-critical, isolated from core data)
      try {
        const latestCashShifts = shop
          ? await cashShiftsService.getByShopId(shop.id, 1)
          : [];
        dispatch({ type: 'SET_CASH_SHIFTS', payload: latestCashShifts });
      } catch (shiftError) {
        console.warn('Failed to load cash shifts:', shiftError);
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

  // Realtime subscriptions for multi-device sync (PRD §4.2 — graceful degradation)
  // Subscribes to products (UPDATE) and sales (INSERT) scoped by shop_id.
  useShopRealtime({ activeShopId: state.activeShopId, dispatch });

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

