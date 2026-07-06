import { useApp } from '../context/SupabaseAppContext';
import { FeatureFlags } from '../types';

export function useFeatureFlag(key: string): boolean {
  const { state } = useApp();
  return state.featureFlags[key] ?? false;
}

export function useFeatureFlags(): FeatureFlags {
  const { state } = useApp();
  return state.featureFlags;
}
