import { type AppState, type AppAction } from './types';
import { cartReducer } from './cartReducer';
import { salesTabsReducer } from './salesTabsReducer';
import { productsReducer } from './productsReducer';
import { customersReducer } from './customersReducer';
import { salesReducer } from './salesReducer';
import { discountsReducer } from './discountsReducer';
import { settingsReducer } from './settingsReducer';
import { uiReducer } from './uiReducer';

export const initialState: AppState = {
  products: [],
  customers: [],
  sales: [],
  users: [],
  discounts: [],
  cart: [],
  currentUser: null,
  selectedCustomer: null,
  settings: {
    storeName: 'CoffeeShop POS',
    storeAddress: '123 Business Street, Colombo 03, Sri Lanka',
    storePhone: '+94 11 234 5678',
    storeEmail: 'info@sekalabs.lk',
    taxRate: 0,
    interfaceMode: 'touch',
    autoBackup: true,
    receiptPrinter: true,
    theme: 'light',
    invoicePrefix: 'INV',
    invoiceCounter: 1000,
  },
  salesTabs: [],
  activeSalesTab: '',
  activeShopId: '',
  shop: null,
  capabilities: ['pos'],
  cashShifts: [],
  loading: false,
  error: null,
};

/**
 * Combined app reducer chains domain reducers in a specific order.
 *
 * ORDER MATTERS: cartReducer runs BEFORE salesTabsReducer because
 * ADD_SALES_TAB and SET_ACTIVE_SALES_TAB also modify cart/selectedCustomer.
 * The chain ensures the last write to those fields wins.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  // cartReducer handles cart + selectedCustomer first
  state = cartReducer(state, action);
  // salesTabsReducer handles tab switching AND may also modify cart/selectedCustomer
  state = salesTabsReducer(state, action);
  // Then the rest in any order
  state = productsReducer(state, action);
  state = customersReducer(state, action);
  state = salesReducer(state, action);
  state = discountsReducer(state, action);
  state = settingsReducer(state, action);
  state = uiReducer(state, action);
  return state;
}
