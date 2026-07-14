"use client";

import { useCallback, useSyncExternalStore } from "react";
import { BASE_SUITE_SIZE, MAX_SUITE_SIZE } from "./fixtures/scenarios";

/** The scenario-library browse size, persisted like the mode switch. */
const STORAGE_KEY = "preflight.librarySize";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): number {
  const raw = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "", 10);
  if (!Number.isInteger(raw)) return BASE_SUITE_SIZE;
  return Math.max(1, Math.min(MAX_SUITE_SIZE, raw));
}

function getServerSnapshot(): number {
  return BASE_SUITE_SIZE;
}

export function useLibrarySize() {
  const size = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setSize = useCallback((n: number) => {
    window.localStorage.setItem(STORAGE_KEY, String(n));
    emit();
  }, []);
  return { size, setSize };
}
