/**
 * Pure token-balance math over the credit ledger. Stateless by design:
 * the balance is always recomputed from the entries, so there is no
 * counter to drift. Debit order: period allowance first, then purchased
 * tokens (packs / auto top-ups / adjustments), which never expire.
 */

export interface LedgerEntryLike {
  /** + credit, − debit, in tokens (simulations). */
  delta: number;
  /** allowance_grant | pack_purchase | auto_topup | run_debit | adjustment */
  kind: string;
  /** Billing period the entry belongs to (grants + debits). */
  periodKey: string | null;
}

export interface Balance {
  /** Allowance left in the current period (never negative). */
  allowanceRemaining: number;
  /** Purchased tokens left (packs, top-ups, adjustments). */
  purchasedRemaining: number;
  /** Launchable total. */
  total: number;
  /** Tokens debited in the current period. */
  periodUsed: number;
  /** Allowance granted for the current period. */
  allowance: number;
}

/** Period key for a monthly plan: the subscription period end when known,
 * else the calendar month. Lifetime (free) plans use "lifetime". */
export function periodKeyFor(
  period: "monthly" | "lifetime",
  now: Date,
  currentPeriodEnd?: Date | null,
): string {
  if (period === "lifetime") return "lifetime";
  if (currentPeriodEnd) return `sub:${currentPeriodEnd.toISOString().slice(0, 10)}`;
  return `cal:${now.toISOString().slice(0, 7)}`;
}

export function computeBalance(
  entries: LedgerEntryLike[],
  currentPeriodKey: string,
): Balance {
  // Per-period tallies of allowance grants vs debits; anything a period's
  // debits exceed its grants by was paid from the purchased pool.
  const grants = new Map<string, number>();
  const debits = new Map<string, number>();
  let purchased = 0;

  for (const e of entries) {
    if (e.kind === "allowance_grant") {
      const key = e.periodKey ?? "none";
      grants.set(key, (grants.get(key) ?? 0) + e.delta);
    } else if (e.kind === "run_debit") {
      const key = e.periodKey ?? "none";
      debits.set(key, (debits.get(key) ?? 0) + Math.abs(e.delta));
    } else {
      // pack_purchase / auto_topup / adjustment — signed, never expires.
      purchased += e.delta;
    }
  }

  let purchasedConsumed = 0;
  for (const [key, used] of debits) {
    purchasedConsumed += Math.max(0, used - (grants.get(key) ?? 0));
  }

  const allowance = grants.get(currentPeriodKey) ?? 0;
  const periodUsed = debits.get(currentPeriodKey) ?? 0;
  const allowanceRemaining = Math.max(0, allowance - periodUsed);
  const purchasedRemaining = Math.max(0, purchased - purchasedConsumed);

  return {
    allowanceRemaining,
    purchasedRemaining,
    total: allowanceRemaining + purchasedRemaining,
    periodUsed,
    allowance,
  };
}
