import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { config } from "./config";
import { log } from "./log";
import { getStripe, priceIdForLookupKey } from "./stripe";
import { computeBalance, periodKeyFor, type Balance } from "./credit-math";
import {
  DEFAULT_CATALOG,
  catalogPlan,
  parseCatalog,
  type BillingCatalog,
  type BillingStatus,
} from "@/lib/billing-catalog";

/**
 * Billing core: the config-driven catalog, the single-workspace
 * account, and the token (simulation-credit) ledger. Real in both
 * modes — with Stripe dormant, purchases are previews but the ledger
 * math is identical to production.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Fallback account for webhook events that predate owner metadata. */
const DEFAULT_ACCOUNT = "default";

let cachedCatalog: BillingCatalog | null = null;

/** The effective catalog: BILLING_CATALOG_JSON override, else default. */
export function activeCatalog(): BillingCatalog {
  if (cachedCatalog) return cachedCatalog;
  if (config.billing.catalogJson) {
    try {
      cachedCatalog = parseCatalog(config.billing.catalogJson);
      log.info("billing", "using BILLING_CATALOG_JSON catalog override");
    } catch (err) {
      log.error("billing", "invalid BILLING_CATALOG_JSON — using default catalog", err);
      cachedCatalog = DEFAULT_CATALOG;
    }
  } else {
    cachedCatalog = DEFAULT_CATALOG;
  }
  return cachedCatalog;
}

export async function getAccount(ownerId: string, db: Db = prisma) {
  return db.billingAccount.upsert({
    where: { id: ownerId },
    create: { id: ownerId },
    update: {},
  });
}

function currentPeriodKey(account: { planId: string; currentPeriodEnd: Date | null }): string {
  const plan = catalogPlan(activeCatalog(), account.planId);
  return periodKeyFor(plan.period, new Date(), account.currentPeriodEnd);
}

/** Grant the current period's allowance once (idempotent per periodKey). */
async function ensureAllowanceGrant(
  db: Db,
  account: { id: string; planId: string; currentPeriodEnd: Date | null },
  periodKey: string,
): Promise<void> {
  const plan = catalogPlan(activeCatalog(), account.planId);
  if (plan.monthlyTokens <= 0) return;
  const existing = await db.creditLedgerEntry.findFirst({
    where: { accountId: account.id, kind: "allowance_grant", periodKey },
    select: { id: true },
  });
  if (existing) return;
  await db.creditLedgerEntry.create({
    data: {
      accountId: account.id,
      delta: plan.monthlyTokens,
      kind: "allowance_grant",
      periodKey,
      note: `${plan.id} ${plan.period} allowance`,
    },
  });
}

async function balanceFor(
  db: Db,
  accountId: string,
  periodKey: string,
): Promise<Balance> {
  const entries = await db.creditLedgerEntry.findMany({
    where: { accountId },
    select: { delta: true, kind: true, periodKey: true },
  });
  return computeBalance(entries, periodKey);
}

/** The one status shape both modes serve (GET /api/billing). */
export async function getBillingStatus(ownerId: string): Promise<BillingStatus> {
  const account = await getAccount(ownerId);
  const periodKey = currentPeriodKey(account);
  await ensureAllowanceGrant(prisma, account, periodKey);
  const balance = await balanceFor(prisma, account.id, periodKey);
  return {
    enabled: config.billing.enabled,
    catalog: activeCatalog(),
    planId: account.planId,
    subscriptionStatus: account.subscriptionStatus,
    currentPeriodEnd: account.currentPeriodEnd?.toISOString() ?? null,
    autoTopUp: account.autoTopUp,
    autoTopUpPackId: account.autoTopUpPackId,
    balance,
  };
}

/**
 * Ensure the ledger can cover a run, attempting an auto top-up when
 * enabled and short. Used by the launch path when a paid subscription
 * is active; the anonymous free tier keeps the identity-keyed
 * FreeGrant ledger until auth lands.
 */
export async function precheckRun(
  ownerId: string,
  sims: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const account = await getAccount(ownerId);
  const periodKey = currentPeriodKey(account);
  await ensureAllowanceGrant(prisma, account, periodKey);

  let balance = await balanceFor(prisma, account.id, periodKey);
  if (balance.total < sims && account.autoTopUp) {
    const topped = await attemptAutoTopUp(account, sims - balance.total);
    if (topped) balance = await balanceFor(prisma, account.id, periodKey);
  }
  if (balance.total < sims) {
    return {
      ok: false,
      reason:
        `This run needs ${sims.toLocaleString()} simulations; ` +
        `${balance.total.toLocaleString()} remain. Buy a token pack or enable auto top-up.`,
    };
  }
  return { ok: true };
}

/** Debit a launched run against the ledger (precheckRun ran first). */
export async function debitRun(ownerId: string, sims: number, runId: string): Promise<void> {
  const account = await getAccount(ownerId);
  const periodKey = currentPeriodKey(account);
  await prisma.creditLedgerEntry.create({
    data: {
      accountId: account.id,
      delta: -sims,
      kind: "run_debit",
      periodKey,
      runId,
    },
  });
}

/** Off-session purchase of the configured top-up pack. Stripe-dormant → false. */
async function attemptAutoTopUp(
  account: { id: string; stripeCustomerId: string | null; autoTopUpPackId: string | null },
  shortfall: number,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe || !account.stripeCustomerId) return false;
  const catalog = activeCatalog();
  const pack =
    catalog.packs.find((p) => p.id === account.autoTopUpPackId) ??
    // Smallest pack that covers the shortfall, else the largest.
    catalog.packs.find((p) => p.tokens >= shortfall) ??
    catalog.packs[catalog.packs.length - 1];
  if (!pack) return false;

  try {
    const customer = await stripe.customers.retrieve(account.stripeCustomerId);
    const paymentMethod =
      !customer.deleted && typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : undefined;
    if (!paymentMethod) {
      log.warn("billing", "auto top-up skipped — no default payment method");
      return false;
    }
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(pack.price * 100),
      currency: "usd",
      customer: account.stripeCustomerId,
      payment_method: paymentMethod,
      off_session: true,
      confirm: true,
      description: `Preflight auto top-up · ${pack.tokens.toLocaleString()} simulations`,
      metadata: { packId: pack.id, kind: "auto_topup" },
    });
    if (intent.status !== "succeeded") {
      log.warn("billing", "auto top-up not completed", { status: intent.status });
      return false;
    }
    await prisma.creditLedgerEntry.create({
      data: {
        accountId: account.id,
        delta: pack.tokens,
        kind: "auto_topup",
        stripeRef: intent.id,
        note: pack.id,
      },
    });
    log.info("billing", "auto top-up succeeded", { packId: pack.id, tokens: pack.tokens });
    return true;
  } catch (err) {
    log.error("billing", "auto top-up failed", err);
    return false;
  }
}

/** Preference writes — and, while Stripe is dormant, preview pack grants. */
export async function updatePrefs(ownerId: string, input: {
  autoTopUp?: boolean;
  autoTopUpPackId?: string | null;
  /** Dormant mode only: credit a pack instantly (preview, no charge). */
  mockPackId?: string;
}): Promise<BillingStatus> {
  const account = await getAccount(ownerId);
  await prisma.billingAccount.update({
    where: { id: account.id },
    data: {
      ...(input.autoTopUp !== undefined ? { autoTopUp: input.autoTopUp } : {}),
      ...(input.autoTopUpPackId !== undefined ? { autoTopUpPackId: input.autoTopUpPackId } : {}),
    },
  });
  if (input.mockPackId && !config.billing.enabled) {
    const pack = activeCatalog().packs.find((p) => p.id === input.mockPackId);
    if (pack) {
      await prisma.creditLedgerEntry.create({
        data: {
          accountId: account.id,
          delta: pack.tokens,
          kind: "pack_purchase",
          note: `${pack.id} (preview — Stripe dormant)`,
        },
      });
    }
  }
  return getBillingStatus(ownerId);
}

/* ------------------------- webhook mutations ------------------------- */

/** Idempotently record + apply one Stripe event. Returns false if seen. */
export async function applyStripeEvent(event: {
  id: string;
  type: string;
  data: { object: unknown };
}): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return false; // PK violation — already processed
  }

  const catalog = activeCatalog();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      mode: string;
      customer?: string | null;
      subscription?: string | null;
      metadata?: Record<string, string>;
    };
    // Checkout sessions carry the owning account in metadata (set at
    // creation); events from before ownership default to the shared row.
    const account = await getAccount(session.metadata?.accountId ?? DEFAULT_ACCOUNT);
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        ...(session.customer ? { stripeCustomerId: String(session.customer) } : {}),
        ...(session.subscription ? { stripeSubscriptionId: String(session.subscription) } : {}),
      },
    });
    const packId = session.metadata?.packId;
    if (session.mode === "payment" && packId) {
      const pack = catalog.packs.find((p) => p.id === packId);
      if (pack) {
        await prisma.creditLedgerEntry.create({
          data: {
            accountId: account.id,
            delta: pack.tokens,
            kind: "pack_purchase",
            stripeRef: session.id,
            note: pack.id,
          },
        });
      }
    }
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as {
      id: string;
      status: string;
      customer: string;
      items?: { data?: Array<{ price?: { lookup_key?: string | null }; current_period_end?: number }> };
    };
    const item = sub.items?.data?.[0];
    const lookupKey = item?.price?.lookup_key ?? null;
    const plan = catalog.plans.find((p) => p.stripeLookupKey === lookupKey);
    const deleted = event.type === "customer.subscription.deleted";
    const periodEnd = item?.current_period_end;
    // Subscription events name only the customer — resolve the account
    // that owns that Stripe customer (set during checkout).
    const owned = await prisma.billingAccount.findFirst({
      where: { stripeCustomerId: String(sub.customer) },
      select: { id: true },
    });
    const account = owned ?? (await getAccount(DEFAULT_ACCOUNT));
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: deleted ? null : sub.id,
        subscriptionStatus: deleted ? "canceled" : sub.status,
        planId: deleted ? "free" : (plan?.id ?? "free"),
        currentPeriodEnd: !deleted && periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const paid = event.type === "invoice.paid";
    log.info("billing", `stripe ${event.type}`, { eventId: event.id });
    if (!paid) {
      const invoice = event.data.object as { customer?: string | null };
      const owned = invoice.customer
        ? await prisma.billingAccount.findFirst({
            where: { stripeCustomerId: String(invoice.customer) },
            select: { id: true },
          })
        : null;
      await prisma.billingAccount.update({
        where: { id: owned?.id ?? DEFAULT_ACCOUNT },
        data: { subscriptionStatus: "past_due" },
      });
    }
  }

  return true;
}

/** Create a Checkout Session for a plan or a pack. Null while dormant. */
export async function createCheckout(
  ownerId: string,
  kind: "plan" | "pack",
  id: string,
  origin: string,
): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Billing is not connected yet — purchases are previews for now.", status: 409 };
  }
  const catalog = activeCatalog();
  const lookupKey =
    kind === "plan"
      ? catalog.plans.find((p) => p.id === id)?.stripeLookupKey
      : catalog.packs.find((p) => p.id === id)?.stripeLookupKey;
  if (!lookupKey) return { error: `Unknown ${kind} "${id}".`, status: 400 };

  const priceId = await priceIdForLookupKey(lookupKey);
  if (!priceId) {
    return {
      error: `No active Stripe price with lookup key "${lookupKey}" — create it in Stripe first (docs/PRODUCTION.md).`,
      status: 409,
    };
  }

  const account = await getAccount(ownerId);
  const session = await stripe.checkout.sessions.create({
    mode: kind === "plan" ? "subscription" : "payment",
    customer: account.stripeCustomerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/billing?checkout=success`,
    cancel_url: `${origin}/billing?checkout=cancelled`,
    metadata: { accountId: account.id, ...(kind === "pack" ? { packId: id } : {}) },
  });
  if (!session.url) return { error: "Stripe did not return a checkout URL.", status: 502 };
  return { url: session.url };
}

/** Billing Portal session for subscription management. */
export async function createPortal(
  ownerId: string,
  origin: string,
): Promise<{ url: string } | { error: string; status: number }> {
  const stripe = getStripe();
  if (!stripe) return { error: "Billing is not connected yet.", status: 409 };
  const account = await getAccount(ownerId);
  if (!account.stripeCustomerId) {
    return { error: "No Stripe customer yet — subscribe to a plan first.", status: 409 };
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${origin}/billing`,
  });
  return { url: session.url };
}
