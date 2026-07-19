import path from "node:path";

/**
 * Central server configuration — every environment variable the server
 * reads, in one place, with defaults that keep local demo/dev working
 * with zero setup. Feature flags derive here so routes can branch on
 * `config.billing.enabled` instead of sniffing env themselves.
 */

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const databaseUrl =
  process.env.DATABASE_URL ??
  `file:${path.join(process.cwd(), "prisma", "preflight.db")}`;

if (databaseUrl.startsWith("postgres")) {
  // The URL alone isn't enough — the driver adapter must be swapped too.
  throw new Error(
    "DATABASE_URL points at Postgres, but the SQLite adapter is configured. " +
      "Follow the Postgres migration steps in docs/PRODUCTION.md.",
  );
}

export const config = {
  isProduction: process.env.NODE_ENV === "production",

  databaseUrl,

  /** LLM provider key; the literal "mock" selects the deterministic provider. */
  llmKey: process.env.PREFLIGHT_LLM_KEY ?? process.env.ANTHROPIC_API_KEY ?? null,
  model: process.env.PREFLIGHT_MODEL ?? "claude-opus-4-8",
  concurrency: int(process.env.PREFLIGHT_CONCURRENCY, 3),

  /** Agent endpoints may reach private/internal hosts only outside
   * production, or when explicitly allowed (self-hosted setups). */
  allowPrivateEndpoints:
    process.env.PREFLIGHT_ALLOW_PRIVATE_ENDPOINTS === "1" ||
    process.env.NODE_ENV !== "production",

  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    /** Billing is dormant until BOTH Stripe secrets exist. */
    enabled: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    /** Optional full catalog override (JSON) — validated where parsed. */
    catalogJson: process.env.BILLING_CATALOG_JSON ?? null,
  },

  /** Optional webhook (Slack-compatible) notified on run completion
   * and regressions. The operator's own endpoint — still SSRF-screened
   * in production. */
  webhookUrl: process.env.PREFLIGHT_WEBHOOK_URL ?? null,

  /** Transcript retention in days; null/0 = keep forever (default).
   * Outcomes and scores are always kept — only transcript/judge JSON
   * is pruned. */
  retentionDays: int(process.env.PREFLIGHT_RETENTION_DAYS, 0) || null,

  auth: {
    /** Supabase project URL (informational; verification is local). */
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    /** Supabase JWT secret (Project Settings → API). Setting it flips
     * every mutating route from open single-workspace mode to
     * verified-user mode — no code change. */
    jwtSecret: process.env.SUPABASE_JWT_SECRET ?? null,
    enabled: !!process.env.SUPABASE_JWT_SECRET,
  },
} as const;
