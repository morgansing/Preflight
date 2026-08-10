"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * SSR-safe reduced-motion flag.
 *
 * Framer's `useReducedMotion()` can resolve to the real media-query value on
 * the first client render, which mismatches the server HTML and triggers a
 * hydration warning. Stay `false` until after mount, then mirror the preference.
 */
export function usePrefersReducedMotion(): boolean {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? !!reduceMotion : false;
}
