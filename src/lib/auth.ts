"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PlanId } from "./billing";

/**
 * V0 workspace session. Same localStorage pattern as the agent
 * registry: the session is real state driving real UI (plan, credits,
 * nudges), but there is no server account yet — production replaces
 * this with proper auth. Passwords are NEVER stored; the password field
 * on the forms is design-complete but write-only in V0.
 */

export interface Session {
  name: string;
  email: string;
  company?: string;
  plan: PlanId;
  createdAt: string;
}

const KEY = "preflight.session";
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

let cacheRaw: string | null = null;
let cacheParsed: Session | null = null;

function getSnapshot(): Session | null {
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheParsed = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cacheParsed = null;
    }
  }
  return cacheParsed;
}

function getServerSnapshot(): Session | null {
  return null;
}

export function useSession() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback((s: Omit<Session, "createdAt" | "plan"> & { plan?: PlanId }) => {
    const next: Session = {
      ...s,
      plan: s.plan ?? "free",
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    emit();
    return next;
  }, []);

  const setPlan = useCallback((plan: PlanId) => {
    const current = getSnapshot();
    if (!current) return;
    window.localStorage.setItem(KEY, JSON.stringify({ ...current, plan }));
    emit();
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(KEY);
    emit();
  }, []);

  return { session, signIn, setPlan, signOut };
}
