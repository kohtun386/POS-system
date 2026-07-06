import { useApp } from '../context/SupabaseAppContext';
import { FeatureFlags } from '../types';

export function useFeatureFlag(key: string): boolean {
  // Feature flags are temporarily disabled for a clean production state
  // const { state } = useApp();
  // return state.featureFlags[key] ?? false;
  return false;
}

export function useFeatureFlags(): FeatureFlags {
  const { state } = useApp();
  return state.featureFlags;
}
