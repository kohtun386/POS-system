import { useApp } from '../context/SupabaseAppContext';

export function useFeatureFlag(key: string): boolean {
  const { state } = useApp();
  return state.featureFlags[key] ?? false;
}
