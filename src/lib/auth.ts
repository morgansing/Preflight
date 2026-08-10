"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PlanId } from "./billing";
import { normalizeEmail } from "./identity";

/**
 * V0 workspace session. The session is real state driving real UI
 * (plan, credits, nudges), but there is no server account yet —
 * production replaces this with proper auth. Persistent sessions use
 * localStorage; tab-scoped sessions use sessionStorage. Passwords are
 * NEVER stored; the password field on the forms is design-complete but
 * write-only in V0.
 */

export interface Session {
  name: string;
  email: string;
  company?: string;
  plan: PlanId;
  createdAt: string;
}

export type SessionPersistence = "persistent" | "session";

/** Canonical identity used when comparing and persisting V0 sessions. */
export function normalizeSessionEmail(email: string): string {
  return normalizeEmail(email);
}

export function isSameSessionEmail(left: string, right: string): boolean {
  return normalizeSessionEmail(left) === normalizeSessionEmail(right);
}

const KEY = "preflight.session";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

let cacheRaw: string | null = null;
let cacheParsed: Session | null = null;
let cachePersistence: SessionPersistence | "none" = "none";

function storedSession(): {
  raw: string | null;
  persistence: SessionPersistence | "none";
} {
  const tabSession = window.sessionStorage.getItem(KEY);
  if (tabSession !== null) {
    return { raw: tabSession, persistence: "session" };
  }

  const persistentSession = window.localStorage.getItem(KEY);
  return {
    raw: persistentSession,
    persistence: persistentSession === null ? "none" : "persistent",
  };
}

function getSnapshot(): Session | null {
  const { raw, persistence } = storedSession();
  if (raw !== cacheRaw || persistence !== cachePersistence) {
    cacheRaw = raw;
    cachePersistence = persistence;
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

function writeSession(next: Session, persistence: SessionPersistence): Session {
  const normalizedEmail = normalizeSessionEmail(next.email);
  const stored = normalizedEmail === next.email ? next : { ...next, email: normalizedEmail };
  const serialized = JSON.stringify(stored);
  if (persistence === "session") {
    window.sessionStorage.setItem(KEY, serialized);
  } else {
    window.localStorage.setItem(KEY, serialized);
  }
  return stored;
}

/** Explicitly choose one persistence location and discard the other. */
function replaceSession(next: Session, persistence: SessionPersistence): Session {
  const stored = writeSession(next, persistence);
  if (persistence === "session") {
    window.localStorage.removeItem(KEY);
  } else {
    window.sessionStorage.removeItem(KEY);
  }
  return stored;
}

export function useSession() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback(
    (
      s: Omit<Session, "createdAt" | "plan"> & { plan?: PlanId },
      persistence: SessionPersistence = "persistent",
    ) => {
      const next: Session = {
        ...s,
        plan: s.plan ?? "free",
        createdAt: new Date().toISOString(),
      };
      const stored = replaceSession(next, persistence);
      emit();
      return stored;
    },
    [],
  );

  const setSessionPersistence = useCallback((persistence: SessionPersistence) => {
    const current = getSnapshot();
    if (!current) return;
    replaceSession(current, persistence);
    emit();
  }, []);

  const setPlan = useCallback((plan: PlanId) => {
    const current = getSnapshot();
    if (!current) return;
    const { persistence } = storedSession();
    if (persistence === "none") return;
    writeSession(current.plan === plan ? current : { ...current, plan }, persistence);
    emit();
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
    emit();
  }, []);

  return { session, signIn, setSessionPersistence, setPlan, signOut };
}
