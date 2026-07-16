"use client";

import { ButtonLink } from "./ui";
import { useSession } from "@/lib/auth";
import { FREE_SIMS, useBillingPrefs, useSimUsage } from "@/lib/billing";

/**
 * The conversion moment: right after someone reads their own agent's
 * failures. Shown only on the free tier (or signed out) — a paid
 * workspace never sees it. Calm, factual, no countdown timers.
 */
export function UpgradeNudge({ simsThisRun }: { simsThisRun: number }) {
  const { session } = useSession();
  const { prefs } = useBillingPrefs();
  const used = useSimUsage();

  if (session && session.plan !== "free") return null;
  const allowance = FREE_SIMS + prefs.extraCredits;
  const remaining = used === undefined ? undefined : Math.max(0, allowance - used);

  return (
    <aside className="no-print mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent/30 bg-accent/5 p-5">
      <div className="min-w-0 max-w-lg">
        <p className="text-[13px] leading-relaxed text-sub">
          This report used{" "}
          <span className="font-mono tabular-nums text-ink">{simsThisRun.toLocaleString()}</span>{" "}
          of your {allowance.toLocaleString()} free simulations
          {remaining !== undefined && (
            <>
              {" — "}
              <span className="font-mono tabular-nums text-ink">
                {remaining.toLocaleString()}
              </span>{" "}
              remain
            </>
          )}
          . Enough to fix the top risks and rerun. When rerunning becomes a habit, plans start
          at $99/mo.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!session && (
          <ButtonLink href="/signup" variant="secondary" size="sm">
            Create workspace
          </ButtonLink>
        )}
        <ButtonLink href="/pricing" size="sm">
          See plans
        </ButtonLink>
      </div>
    </aside>
  );
}
