import { FREE_SIMS } from "./plan-constants";

/**
 * The billing catalog — every price, token allowance, and limit in one
 * configuration object. "Tokens" are simulation credits (one scenario
 * executed in a live run). The server can replace this entire catalog
 * via the BILLING_CATALOG_JSON env var (validated on parse); Stripe
 * prices resolve by lookup key, so pricing changes are config-only.
 *
 * Isomorphic on purpose: the pricing/billing pages render the same
 * catalog the server enforces.
 */

export interface CatalogPlan {
  id: string;
  name: string;
  /** null = free */
  priceMonthly: number | null;
  /** Token (simulation) allowance per period. */
  monthlyTokens: number;
  /** "monthly" grants reset per billing period; "lifetime" is a one-time grant (free tier). */
  period: "monthly" | "lifetime";
  /** Unused allowance carries into the next period. */
  rollover: boolean;
  /** $ per 1,000 tokens beyond the allowance (auto-overage); null = none. */
  overagePer1k: number | null;
  /** Stripe price lookup key; null = not purchasable (free tier). */
  stripeLookupKey: string | null;
  limits: {
    /** Largest launchable suite tier id. */
    maxSuite: string;
    /** Harness concurrency cap. */
    concurrency: number;
  };
  tagline: string;
  features: string[];
}

export interface CatalogPack {
  id: string;
  /** Tokens (simulations) in the pack — purchased tokens never expire. */
  tokens: number;
  price: number;
  stripeLookupKey: string;
}

export interface BillingCatalog {
  plans: CatalogPlan[];
  packs: CatalogPack[];
}

export const DEFAULT_CATALOG: BillingCatalog = {
  plans: [
    {
      id: "free",
      name: "Free",
      priceMonthly: null,
      monthlyTokens: FREE_SIMS,
      period: "lifetime",
      rollover: false,
      overagePer1k: null,
      stripeLookupKey: null,
      limits: { maxSuite: "standard", concurrency: 3 },
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
      monthlyTokens: 2_000,
      period: "monthly",
      rollover: false,
      overagePer1k: 60,
      stripeLookupKey: "preflight_starter_monthly",
      limits: { maxSuite: "scale", concurrency: 3 },
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
      monthlyTokens: 10_000,
      period: "monthly",
      rollover: false,
      overagePer1k: 50,
      stripeLookupKey: "preflight_team_monthly",
      limits: { maxSuite: "exhaustive", concurrency: 6 },
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
      monthlyTokens: 50_000,
      period: "monthly",
      rollover: false,
      overagePer1k: 40,
      stripeLookupKey: "preflight_scale_monthly",
      limits: { maxSuite: "max", concurrency: 10 },
      tagline: "Sign-off depth, nightly.",
      features: [
        "50,000 simulations / month",
        "Everything in Team",
        "Exhaustive & Max tiers on tap",
        "Overage: credit packs or $40 per extra 1,000",
      ],
    },
  ],
  packs: [
    { id: "pack_1000", tokens: 1_000, price: 60, stripeLookupKey: "preflight_pack_1000" },
    { id: "pack_5000", tokens: 5_000, price: 250, stripeLookupKey: "preflight_pack_5000" },
    { id: "pack_25000", tokens: 25_000, price: 1_000, stripeLookupKey: "preflight_pack_25000" },
  ],
};

/** Parse + validate a catalog override. Throws with a precise reason. */
export function parseCatalog(json: string): BillingCatalog {
  const raw = JSON.parse(json) as BillingCatalog;
  if (!Array.isArray(raw?.plans) || raw.plans.length === 0) {
    throw new Error("catalog.plans must be a non-empty array");
  }
  if (!Array.isArray(raw?.packs)) throw new Error("catalog.packs must be an array");
  for (const p of raw.plans) {
    if (!p.id || typeof p.monthlyTokens !== "number" || p.monthlyTokens < 0) {
      throw new Error(`plan "${p?.id}" needs an id and a non-negative monthlyTokens`);
    }
    if (p.period !== "monthly" && p.period !== "lifetime") {
      throw new Error(`plan "${p.id}" period must be "monthly" or "lifetime"`);
    }
    if (p.priceMonthly !== null && !p.stripeLookupKey) {
      throw new Error(`paid plan "${p.id}" needs a stripeLookupKey`);
    }
  }
  for (const pack of raw.packs) {
    if (!pack.id || typeof pack.tokens !== "number" || pack.tokens <= 0 || !pack.stripeLookupKey) {
      throw new Error(`pack "${pack?.id}" needs id, positive tokens, and a stripeLookupKey`);
    }
  }
  if (!raw.plans.some((p) => p.priceMonthly === null)) {
    throw new Error("catalog needs at least one free plan");
  }
  return raw;
}

export function catalogPlan(catalog: BillingCatalog, id: string): CatalogPlan {
  return catalog.plans.find((p) => p.id === id) ?? catalog.plans[0];
}

/** The shared client/server status shape served by GET /api/billing. */
export interface BillingStatus {
  /** false = Stripe dormant (no keys) — purchases are previews. */
  enabled: boolean;
  catalog: BillingCatalog;
  planId: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  autoTopUp: boolean;
  autoTopUpPackId: string | null;
  balance: {
    allowanceRemaining: number;
    purchasedRemaining: number;
    total: number;
    periodUsed: number;
    allowance: number;
  };
}
