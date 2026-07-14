"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Live-mode agent registry. V0 scaffolding: registrations persist in
 * localStorage; the run harness (simulated store + judge) arrives in
 * build steps 7–8 and will read from the same registry. Live mode never
 * falls back to scripted data — with no runs, surfaces stay empty.
 */

export type ConnectionKind = "http" | "mcp" | "reference";

export interface RegisteredAgent {
  id: string;
  name: string;
  kind: ConnectionKind;
  endpoint?: string;
  createdAt: string;
}

const KEY = "preflight.live.agents";
const EMPTY: RegisteredAgent[] = [];
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

// getSnapshot must be referentially stable between writes.
let cacheRaw: string | null = null;
let cacheParsed: RegisteredAgent[] = EMPTY;

function getSnapshot(): RegisteredAgent[] {
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheParsed = JSON.parse(raw);
    } catch {
      cacheParsed = EMPTY;
    }
  }
  return cacheParsed;
}

function getServerSnapshot(): RegisteredAgent[] {
  return EMPTY;
}

export function useLiveAgents() {
  const agents = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const register = useCallback(
    (a: Omit<RegisteredAgent, "id" | "createdAt">) => {
      const agent: RegisteredAgent = {
        ...a,
        id: `agt_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      window.localStorage.setItem(KEY, JSON.stringify([agent, ...getSnapshot()]));
      emit();
      return agent;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(getSnapshot().filter((a) => a.id !== id)),
    );
    emit();
  }, []);

  return { agents, register, remove };
}
