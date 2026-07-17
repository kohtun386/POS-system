import type { Dispatch } from 'react';
import type { AppAction } from './index';

declare global {
  interface Window {
    /**
     * Exposes dispatch to E2E tests for setting capabilities
     * without page reload. Only available in dev/test environments.
     */
    __appDispatch?: Dispatch<AppAction>;
  }
}

export {};
