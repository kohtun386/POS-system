import { useApp } from '../context/SupabaseAppContext';

/**
 * @deprecated Use `useCapability(key)` from SupabaseAppContext instead.
 * Capabilities are resolved server-side per shop tier and stored in `state.capabilities`.
 */
export function useFeatureFlag(key: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(key);
}

/**
 * @deprecated Use `state.capabilities` (string[]) from useApp() instead.
 * This exists only for backward compat with components not yet migrated to capabilities.
 */
export function useFeatureFlags(): FeatureFlags {
  const { state } = useApp();
  const flags: FeatureFlags = {};
  for (const cap of state.capabilities) {
    flags[cap] = true;
  }
  return flags;
}
