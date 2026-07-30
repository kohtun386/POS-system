import { type AppState, type AppAction } from './types';

export function salesTabsReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_SALES_TAB':
      return {
        ...state,
        salesTabs: [...state.salesTabs, action.payload],
        activeSalesTab: action.payload.id,
        cart: action.payload.cart || [],
        selectedCustomer: action.payload.selectedCustomer || null,
      };
    case 'UPDATE_SALES_TAB':
      return {
        ...state,
        salesTabs: state.salesTabs.map(tab =>
          tab.id === action.payload.id ? { ...tab, ...action.payload.updates } : tab
        ),
      };
    case 'REMOVE_SALES_TAB': {
      const remainingTabs = state.salesTabs.filter(tab => tab.id !== action.payload);
      return {
        ...state,
        salesTabs: remainingTabs,
        activeSalesTab: remainingTabs.length > 0 ? remainingTabs[0].id : '',
      };
    }
    case 'SET_ACTIVE_SALES_TAB': {
      const activeTab = state.salesTabs.find(tab => tab.id === action.payload);
      return {
        ...state,
        activeSalesTab: action.payload,
        cart: activeTab?.cart || [],
        selectedCustomer: activeTab?.selectedCustomer || null,
      };
    }
    case 'SET_SALES_TABS':
      return { ...state, salesTabs: action.payload };
    default:
      return state;
  }
}
