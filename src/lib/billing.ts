"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fetchRuns } from "./live-api";
import { authHeaders } from "./supabase";

/**
 * Billing model: the unit is the simulation — one scenario executed in
 * a live run. Not seats, not days. Free isn't a trial clock, it's the
 * first 250 simulations, because the product's "wow" is watching your
 * own agent fail; a subscription is a monthly allowance of simulations
 * so Preflight lives inside build → test → fix → rerun → ship; overage
 * is either prepaid credit packs or opt-in automatic billing.
 *
 * V0: usage is REAL — summed from the scenarios actually executed by
 * live runs on this workspace. Purchases/toggles persist locally and
 * are clearly labeled preview; production wires Stripe server-side.
 */

import { FREE_SIMS } from "./plan-constants";
import { DEFAULT_CATALOG, type BillingStatus } from "./billing-catalog";

export type PlanId = "free" | "starter" | "team" | "scale";

/** Re-exported for existing importers; canonical home is plan-constants. */
export { FREE_SIMS };

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number | null; // null = free
  /** Simulations included. Free: one-time grant, not monthly. */
  simsIncluded: number;
  /** $ per 1,000 simulations beyond the allowance (auto-overage). */
  overagePer1k: number | null;
  tagline: string;
  features: string[];
}

/** Derived from the config-driven catalog — single source of truth for
 * prices, token allowances, and limits (see billing-catalog.ts; the
 * server can override the whole catalog via BILLING_CATALOG_JSON). */
export const PLANS: Plan[] = DEFAULT_CATALOG.plans.map((p) => ({
  id: p.id as PlanId,
  name: p.name,
  priceMonthly: p.priceMonthly,
  simsIncluded: p.monthlyTokens,
  overagePer1k: p.overagePer1k,
  tagline: p.tagline,
  features: p.features,
}));

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export interface CreditPack {
  id: string;
  sims: number;
  price: number;
}

export const CREDIT_PACKS: CreditPack[] = DEFAULT_CATALOG.packs.map((p) => ({
  id: p.id,
  sims: p.tokens,
  price: p.price,
}));

// ---------------------------------------------------------------- state
/** Locally persisted billing prefs: purchased packs + auto-overage. */
interface BillingPrefs {
  extraCredits: number;
  autoOverage: boolean;
}

const KEY = "preflight.billing";
const DEFAULTS: BillingPrefs = { extraCredits: 0, autoOverage: false };
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
let cacheParsed: BillingPrefs = DEFAULTS;

function getSnapshot(): BillingPrefs {
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheParsed = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      cacheParsed = DEFAULTS;
    }
  }
  return cacheParsed;
}

function getServerSnapshot(): BillingPrefs {
  return DEFAULTS;
}

export function useBillingPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addCredits = useCallback((sims: number) => {
    const current = getSnapshot();
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...current, extraCredits: current.extraCredits + sims }),
    );
    emit();
  }, []);

  const setAutoOverage = useCallback((on: boolean) => {
    window.localStorage.setItem(KEY, JSON.stringify({ ...getSnapshot(), autoOverage: on }));
    emit();
  }, []);

  return { prefs, addCredits, setAutoOverage };
}

/**
 * Server-truth billing status: the effective catalog, plan, token
 * balance and prefs from GET /api/billing. `status === null` after
 * load means the endpoint was unreachable — callers show an
 * unavailable state, never fake numbers.
 */
async function fetchBillingStatus(): Promise<BillingStatus | null> {
  try {
    const res = await fetch("/api/billing", { headers: await authHeaders() });
    return res.ok ? ((await res.json()) as BillingStatus) : null;
  } catch {
    return null;
  }
}

export function useBillingStatus() {
  const [status, setStatus] = useState<BillingStatus | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetchBillingStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setStatus(await fetchBillingStatus());
  }, []);

  const setPrefs = useCallback(
    async (input: { autoTopUp?: boolean; autoTopUpPackId?: string | null; mockPackId?: string }) => {
      try {
        const res = await fetch("/api/billing/prefs", {
          method: "POST",
          headers: { "content-type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify(input),
        });
        if (res.ok) setStatus((await res.json()) as BillingStatus);
      } catch {
        // leave current status; the UI keeps its last known truth
      }
    },
    [],
  );

  /** Start checkout; resolves the redirect URL or an error message. */
  const checkout = useCallback(async (kind: "plan" | "pack", id: string) => {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ kind, id }),
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && json.url) return { url: json.url };
    return { error: json.error ?? `HTTP ${res.status}` };
  }, []);

  return { status, refresh, setPrefs, checkout };
}

/**
 * Real usage: simulations executed by live runs on this workspace.
 * undefined while loading; null when the fetch failed — callers show
 * an unavailable state instead of a wrong "0 used".
 */
export function useSimUsage(): number | undefined | null {
  const [used, setUsed] = useState<number | undefined | null>(undefined);
  useEffect(() => {
    let alive = true;
    fetchRuns()
      .then((runs) => {
        if (alive) setUsed(runs ? runs.reduce((a, r) => a + r.total, 0) : null);
      })
      .catch(() => {
        if (alive) setUsed(null);
      });
    return () => {
      alive = false;
    };
  }, []);
  return used;
}
