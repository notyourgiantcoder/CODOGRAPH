"use client";

import { useCallback, useSyncExternalStore } from "react";

/** SSR-safe media query hook. The server snapshot is `false` (mobile-first). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Hydration-safe `prefers-reduced-motion`: false on the server and during hydration. */
export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
