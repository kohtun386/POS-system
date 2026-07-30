import { type AppState, type AppAction } from './types';

export function salesReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SALES':
      return { ...state, sales: action.payload };
    case 'ADD_SALE':
      return { ...state, sales: [...state.sales, action.payload] };
    case 'DELETE_SALE':
      return {
        ...state,
        sales: state.sales.filter(sale => sale.id !== action.payload),
      };
    default:
      return state;
  }
}
