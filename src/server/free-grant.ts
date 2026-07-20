import type { PrismaClient } from "@prisma/client";
import { normalizeEmail, type WorkspaceIdentity } from "@/lib/identity";
import { FREE_SIMS } from "@/lib/plan-constants";

/**
 * Free-grant enforcement. The 250-simulation free grant is tracked
 * server-side against every identity dimension we have — a normalized
 * email and a device fingerprint — so cycling accounts (alias emails,
 * fresh signups from the same browser) can't reset it. This is the
 * substantive anti-farming layer; production auth simply makes the
 * identity non-forgeable, the ledger is the same.
 */

export interface FreeAllowance {
  allowance: number;
  used: number;
  remaining: number;
  blocked: boolean;
}

function keysFor(
  identity: WorkspaceIdentity,
  userId?: string,
): Array<{ key: string; kind: string }> {
  const keys: Array<{ key: string; kind: string }> = [];
  // The verified account is the strongest dimension once auth is live.
  if (userId && userId !== "default") {
    keys.push({ key: `user:${userId}`, kind: "user" });
  }
  if (identity.email && identity.email.includes("@")) {
    keys.push({ key: `email:${normalizeEmail(identity.email)}`, kind: "email" });
  }
  if (identity.fingerprint) {
    keys.push({ key: `fp:${identity.fingerprint}`, kind: "fingerprint" });
  }
  return keys;
}

/**
 * How much of the free grant this identity has consumed. Uses the MAX
 * across dimensions (not the sum) — the same person seen under both an
 * email and a fingerprint is one grant, bound by whichever dimension
 * has burned the most.
 */
export async function checkFreeAllowance(
  prisma: PrismaClient,
  identity: WorkspaceIdentity,
  userId?: string,
): Promise<FreeAllowance> {
  const keys = keysFor(identity, userId);
  let used = 0;
  if (keys.length > 0) {
    const rows = await prisma.freeGrant.findMany({
      where: { key: { in: keys.map((k) => k.key) } },
    });
    used = rows.reduce((max, r) => Math.max(max, r.simsUsed), 0);
  }
  const remaining = Math.max(0, FREE_SIMS - used);
  return { allowance: FREE_SIMS, used, remaining, blocked: remaining <= 0 };
}

/** Charge `sims` against every identity dimension. Each key tracks the
 * cumulative for its dimension; the check reads the max across them. */
export async function recordFreeUsage(
  prisma: PrismaClient,
  identity: WorkspaceIdentity,
  sims: number,
  userId?: string,
): Promise<void> {
  const keys = keysFor(identity, userId);
  for (const { key, kind } of keys) {
    await prisma.freeGrant.upsert({
      where: { key },
      create: { key, kind, simsUsed: sims },
      update: { simsUsed: { increment: sims } },
    });
  }
}
