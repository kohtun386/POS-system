import { useContext } from 'react';
import { AppContext } from '../context/SupabaseAppContext';

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useActiveShopId(): string {
  const { state } = useApp();
  return state.activeShopId;
}
