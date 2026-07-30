import {
  Product, Customer, Sale, User, Discount, CartItem, AppSettings, SalesTab, Shop, CashShift,
} from '../../types';

export interface AppState {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  users: User[];
  discounts: Discount[];
  cart: CartItem[];
  currentUser: User | null;
  settings: AppSettings;
  selectedCustomer: Customer | null;
  salesTabs: SalesTab[];
  activeSalesTab: string;
  activeShopId: string;
  shop: Shop | null;
  capabilities: string[];
  cashShifts: CashShift[];
  loading: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'SET_CUSTOMERS'; payload: Customer[] }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'DELETE_CUSTOMER'; payload: string }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'UPDATE_CART_ITEM'; payload: { index: number; item: CartItem } }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CURRENT_USER'; payload: User | null }
  | { type: 'SET_SELECTED_CUSTOMER'; payload: Customer | null }
  | { type: 'SET_SALES'; payload: Sale[] }
  | { type: 'ADD_SALE'; payload: Sale }
  | { type: 'DELETE_SALE'; payload: string }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'INCREMENT_INVOICE_COUNTER'; payload: number }
  | { type: 'SET_DISCOUNTS'; payload: Discount[] }
  | { type: 'ADD_DISCOUNT'; payload: Discount }
  | { type: 'UPDATE_DISCOUNT'; payload: Discount }
  | { type: 'DELETE_DISCOUNT'; payload: string }
  | { type: 'ADD_SALES_TAB'; payload: SalesTab }
  | { type: 'UPDATE_SALES_TAB'; payload: { id: string; updates: Partial<SalesTab> } }
  | { type: 'REMOVE_SALES_TAB'; payload: string }
  | { type: 'SET_ACTIVE_SALES_TAB'; payload: string }
  | { type: 'SET_SALES_TABS'; payload: SalesTab[] }
  | { type: 'SET_ACTIVE_SHOP'; payload: string }
  | { type: 'SET_SHOP'; payload: Shop | null }
  | { type: 'SET_CAPABILITIES'; payload: string[] }
  | { type: 'SET_CASH_SHIFTS'; payload: CashShift[] }
  | { type: 'ADD_CASH_SHIFT'; payload: CashShift }
  | { type: 'UPDATE_CASH_SHIFT'; payload: CashShift };
