import { type AppState, type AppAction } from './types';

export function cartReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CART':
      return { ...state, cart: action.payload };
    case 'ADD_TO_CART':
      return { ...state, cart: [...state.cart, action.payload] };
    case 'UPDATE_CART_ITEM':
      return {
        ...state,
        cart: state.cart.map((item, index) =>
          index === action.payload.index ? action.payload.item : item
        ),
      };
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((_, index) => index !== action.payload),
      };
    case 'CLEAR_CART':
      return { ...state, cart: [], selectedCustomer: null };
    case 'SET_SELECTED_CUSTOMER':
      return { ...state, selectedCustomer: action.payload };
    default:
      return state;
  }
}
