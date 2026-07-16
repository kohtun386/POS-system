/**
 * Shared lazy-loaded components.
 * Deduplicates React.lazy() wrappers so multiple consumers
 * reference the same pending promise and module cache entry.
 *
 * ReportsManager (442KB) is lazy-loaded here and consumed by both
 * App.tsx (reports route) and POSTerminal.tsx (mobile admin dashboard).
 * Without this shared reference, two independent React.lazy() wrappers
 * would create separate promise caches and duplicate error handling.
 */
import { lazy } from 'react';

export const ReportsManager = lazy(() =>
  import('./components/reports/ReportsManager').then(m => ({ default: m.ReportsManager }))
);
