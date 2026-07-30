import { type AppState, type AppAction } from './types';

// TODO: Split settingsReducer into domain-specific reducers (shop, capabilities, users, cashShifts) in future PR
export function settingsReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'INCREMENT_INVOICE_COUNTER':
      return {
        ...state,
        settings: {
          ...state.settings,
          invoiceCounter: action.payload,
        },
      };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_ACTIVE_SHOP':
      return { ...state, activeShopId: action.payload };
    case 'SET_SHOP':
      return { ...state, shop: action.payload };
    case 'SET_CAPABILITIES':
      return { ...state, capabilities: action.payload };
    case 'SET_CASH_SHIFTS':
      return { ...state, cashShifts: action.payload };
    case 'ADD_CASH_SHIFT':
      return { ...state, cashShifts: [action.payload, ...state.cashShifts] };
    case 'UPDATE_CASH_SHIFT':
      return {
        ...state,
        cashShifts: state.cashShifts.map(cs => cs.id === action.payload.id ? action.payload : cs),
      };
    default:
      return state;
  }
}
