"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { fetchRuns } from "./live-api";

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

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: null,
    simsIncluded: FREE_SIMS,
    overagePer1k: null,
    tagline: "See your agent fail before you pay a thing.",
    features: [
      "First 250 simulations free — one-time, no card",
      "Connect one agent (OpenAI-compatible, HTTP, or reference)",
      "Build a Rulebook + generate a custom suite",
      "Full replays, readiness report, benchmark",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 99,
    simsIncluded: 2_000,
    overagePer1k: 60,
    tagline: "Test every meaningful change.",
    features: [
      "2,000 simulations / month (~10 Standard runs)",
      "Unlimited agents & Rulebook suites",
      "Regression baselines + CI gate",
      "Overage: credit packs or $60 per extra 1,000",
    ],
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 399,
    simsIncluded: 10_000,
    overagePer1k: 50,
    tagline: "Preflight on every pull request.",
    features: [
      "10,000 simulations / month",
      "Everything in Starter",
      "Higher run concurrency (faster walls)",
      "Overage: credit packs or $50 per extra 1,000",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthly: 1_499,
    simsIncluded: 50_000,
    overagePer1k: 40,
    tagline: "Sign-off depth, nightly.",
    features: [
      "50,000 simulations / month",
      "Everything in Team",
      "Exhaustive & Max tiers on tap",
      "Overage: credit packs or $40 per extra 1,000",
    ],
  },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export interface CreditPack {
  sims: number;
  price: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { sims: 1_000, price: 60 },
  { sims: 5_000, price: 250 },
  { sims: 25_000, price: 1_000 },
];

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
 * Real usage: simulations executed by live runs on this workspace.
 * undefined while loading.
 */
export function useSimUsage(): number | undefined {
  const [used, setUsed] = useState<number | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchRuns()
      .then((runs) => {
        if (alive) setUsed(runs.reduce((a, r) => a + r.total, 0));
      })
      .catch(() => {
        if (alive) setUsed(0);
      });
    return () => {
      alive = false;
    };
  }, []);
  return used;
}
