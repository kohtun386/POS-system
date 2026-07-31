import { useApp } from './useApp';

export function useCapability(name: string): boolean {
  const { state } = useApp();
  return state.capabilities.includes(name);
}
