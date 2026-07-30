import { type AppState, type AppAction } from './types';

export function discountsReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DISCOUNTS':
      return { ...state, discounts: action.payload };
    case 'ADD_DISCOUNT':
      return { ...state, discounts: [...state.discounts, action.payload] };
    case 'UPDATE_DISCOUNT':
      return {
        ...state,
        discounts: state.discounts.map(d => d.id === action.payload.id ? action.payload : d),
      };
    case 'DELETE_DISCOUNT':
      return {
        ...state,
        discounts: state.discounts.filter(d => d.id !== action.payload),
      };
    default:
      return state;
  }
}
