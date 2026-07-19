"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PlanId } from "./billing";
import { getSupabase } from "./supabase";

/**
 * Workspace session. Without Supabase env vars this is the V0
 * localStorage session, exactly as before. With them, Supabase Auth is
 * the source of truth and its session is mirrored into the same local
 * shape — every surface that reads useSession() works unchanged in
 * both modes. Passwords are never stored here in either mode.
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
  ensureSupabaseBridge();
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Mirror the Supabase session into the local shape. Runs once, on the
 * first subscriber; a no-op while Supabase is unconfigured. Initialising
 * the client here also completes OAuth redirects (the code in the URL)
 * on whatever page the user lands on. */
let bridged = false;
function ensureSupabaseBridge() {
  if (bridged) return;
  const supabase = getSupabase();
  if (!supabase) return;
  bridged = true;
  supabase.auth.onAuthStateChange((event, s) => {
    if (s?.user) {
      const meta = (s.user.user_metadata ?? {}) as Record<string, string | undefined>;
      const current = getSnapshot();
      const next: Session = {
        name: meta.name ?? meta.full_name ?? s.user.email?.split("@")[0] ?? "Workspace",
        email: s.user.email ?? "",
        company: meta.company,
        plan: current?.plan ?? "free",
        createdAt: current?.createdAt ?? s.user.created_at ?? new Date().toISOString(),
      };
      if (JSON.stringify(next) !== cacheRaw) {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        emit();
      }
    } else if (event === "SIGNED_OUT") {
      window.localStorage.removeItem(KEY);
      emit();
    }
  });
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
    void getSupabase()?.auth.signOut();
    window.localStorage.removeItem(KEY);
    emit();
  }, []);

  return { session, signIn, setPlan, signOut };
}
