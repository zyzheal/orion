/**
 * A11y helper utilities
 * - useClickAndKey: click + keyboard handler for div/span acting as button
 * - useMediaQuery: reactive media query hook
 */
import { useState, useEffect } from 'react';

/**
 * Hook: attach click + keyboard (Enter/Space) handler to a div/span.
 * Use this instead of raw onClick on non-button elements.
 */
export function useClickAndKey(onClick: (e: React.MouseEvent | React.KeyboardEvent) => void) {
  return (
    e: React.MouseEvent<HTMLDivElement | HTMLSpanElement> | React.KeyboardEvent<HTMLDivElement | HTMLSpanElement>,
  ) => {
    if (e instanceof KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    } else {
      onClick(e);
    }
  };
}

/**
 * Hook: reactive media query detection.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    // Set initial value
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
