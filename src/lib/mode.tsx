"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Demo vs Live. Same components, same routes — only the data source differs.
 * Demo reads from bundled fixtures and never touches the network.
 * Live reads from the harness API and never falls back to scripted data.
 *
 * The choice persists in localStorage; demo is the default on first load.
 */
export type Mode = "demo" | "live";

const STORAGE_KEY = "preflight.mode";
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

function getSnapshot(): Mode {
  return window.localStorage.getItem(STORAGE_KEY) === "live" ? "live" : "demo";
}

function getServerSnapshot(): Mode {
  return "demo";
}

export function useMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setMode = useCallback((m: Mode) => {
    window.localStorage.setItem(STORAGE_KEY, m);
    emit();
  }, []);
  return { mode, setMode };
}
