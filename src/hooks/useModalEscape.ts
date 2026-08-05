import { useEffect } from 'react';

/**
 * Listens for the Escape key and calls onClose when pressed.
 * Attach to any modal component to enable keyboard dismissal.
 */
export function useModalEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, enabled]);
}
