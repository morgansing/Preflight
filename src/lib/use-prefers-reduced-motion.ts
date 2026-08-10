"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe reduced-motion flag.
 *
 * Always report `false` during SSR/hydration (`getServerSnapshot`), then mirror
 * the real media query on the client. Avoids hydration mismatches without a
 * mount `setState` effect.
 */
function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerSnapshot() {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
