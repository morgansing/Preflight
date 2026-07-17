"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { useSession } from "@/lib/auth";
import {
  CREDIT_PACKS,
  PLANS,
  planById,
  useBillingPrefs,
  useBillingStatus,
  useSimUsage,
} from "@/lib/billing";
import { fetchFreeAllowance, type FreeAllowance } from "@/lib/live-api";
import { computeFingerprint } from "@/lib/identity";

/**
 * Billing & usage. The meter is real — it counts simulations actually
 * executed by live runs on this workspace. Purchases and plan switches
 * are V0 previews (localStorage) until payments land server-side.
 */

export default function BillingPage() {
  const { session, setPlan } = useSession();
  const { prefs, addCredits, setAutoOverage } = useBillingPrefs();
  const billing = useBillingStatus();
  const used = useSimUsage();
  const [freeGrant, setFreeGrant] = useState<FreeAllowance | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Server truth when the billing API is reachable; localStorage
  // preview otherwise (st === null after load = endpoint unavailable).
  const st = billing.status ?? null;
  const extraCredits = st ? st.balance.purchasedRemaining : prefs.extraCredits;
  const autoTopUpOn = st ? st.autoTopUp : prefs.autoOverage;

  const toggleAutoTopUp = () => {
    if (st) void billing.setPrefs({ autoTopUp: !autoTopUpOn });
    else setAutoOverage(!autoTopUpOn);
  };

  const buyPack = async (packId: string, sims: number) => {
    setCheckoutError(null);
    if (st?.enabled) {
      const r = await billing.checkout("pack", packId);
      if ("url" in r && r.url) window.location.assign(r.url);
      else if ("error" in r) setCheckoutError(r.error ?? "Checkout failed.");
    } else if (st) {
      await billing.setPrefs({ mockPackId: packId });
    } else {
      addCredits(sims);
    }
  };

  const choosePlan = async (planId: (typeof PLANS)[number]["id"]) => {
    setCheckoutError(null);
    if (st?.enabled && planId !== "free") {
      const r = await billing.checkout("plan", planId);
      if ("url" in r && r.url) window.location.assign(r.url);
      else if ("error" in r) setCheckoutError(r.error ?? "Checkout failed.");
    } else {
      setPlan(planId);
    }
  };

  useEffect(() => {
    if (!session || session.plan !== "free") return;
    fetchFreeAllowance({ email: session.email, fingerprint: computeFingerprint() }).then(setFreeGrant);
  }, [session]);

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-8 py-24 text-center">
        <Eyebrow>Billing</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
          Sign in to see your plan and usage
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          Usage is metered per workspace — simulations executed, not days elapsed.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <ButtonLink href="/signup">Create a workspace</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  const plan = planById(session.plan);
  const allowance = plan.simsIncluded + extraCredits;
  const pct = used == null ? 0 : Math.min(100, Math.round((used / allowance) * 100));
  const remaining = used == null ? undefined : Math.max(0, allowance - used);
  const over = used != null && used > allowance ? used - allowance : 0;
  const barTint = pct >= 100 ? "bg-fail" : pct >= 80 ? "bg-warn" : "bg-accent";

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Eyebrow>Billing &amp; usage</Eyebrow>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
        {plan.name} plan
        {plan.priceMonthly !== null && (
          <span className="ml-3 text-xl text-sub">${plan.priceMonthly}/mo</span>
        )}
      </h1>
      <p className="mt-2 text-sm text-sub">
        {session.email}
        {session.company ? ` · ${session.company}` : ""}
      </p>

      {/* Usage meter — real numbers from real runs. */}
      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Eyebrow>Simulations used</Eyebrow>
          <span className="font-mono text-[13px] tabular-nums text-sub">
            {used === undefined ? "…" : used === null ? "—" : used.toLocaleString()} /{" "}
            {allowance.toLocaleString()}
            {plan.priceMonthly === null ? " one-time" : " this cycle"}
            {extraCredits > 0 &&
              ` (incl. ${extraCredits.toLocaleString()} pack credits)`}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barTint}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
          <span className="text-sub">
            {used === null
              ? "Usage unavailable — couldn\u2019t reach the server."
              : remaining === undefined
                ? "Counting…"
              : over > 0
                ? `${over.toLocaleString()} simulations over allowance`
                : `${remaining.toLocaleString()} remaining`}
          </span>
          <span className="font-mono text-[11px] text-mut">
            metered from live runs on this workspace
          </span>
        </div>
        {over > 0 && (
          <p
            className={`mt-3 rounded-lg border p-3 text-[13px] leading-relaxed ${
              autoTopUpOn
                ? "border-edge text-sub"
                : "border-warn/40 bg-warn/8 text-warn"
            }`}
          >
            {autoTopUpOn && plan.overagePer1k
              ? `Auto-overage is on: the extra ${over.toLocaleString()} bills at $${plan.overagePer1k}/1,000 (≈ $${Math.ceil((over / 1000) * plan.overagePer1k)}).`
              : "You're past your allowance — new runs will ask you to add credits or enable auto-overage before starting."}
          </p>
        )}
        {plan.priceMonthly === null && freeGrant && (
          <div className="mt-4 border-t border-edge pt-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-sub">Free grant</span>
              <span className="font-mono tabular-nums text-sub">
                {freeGrant.used.toLocaleString()} / {freeGrant.allowance.toLocaleString()} used
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-mut">
              Enforced server-side against your email and device, so alias emails and repeat
              sign-ups can&apos;t reset it. {freeGrant.remaining.toLocaleString()} simulations left
              before a plan or credits are needed.
            </p>
          </div>
        )}
      </Card>

      {/* Overage controls */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[15px] font-medium text-ink">Automatic overage</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
                {plan.overagePer1k
                  ? `Bill extra usage at $${plan.overagePer1k} per 1,000 simulations instead of pausing between runs.`
                  : "Not available on Free — upgrade to keep running past your allowance."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoTopUpOn}
              disabled={!plan.overagePer1k}
              onClick={toggleAutoTopUp}
              className={`focus-ring relative mt-1 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                autoTopUpOn ? "bg-accent" : "bg-raised border border-edge"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-ink transition-all ${
                  autoTopUpOn ? "left-[22px] bg-[#08110b]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-[15px] font-medium text-ink">Credit packs</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
            Prepaid, never expire, used after your allowance.
          </p>
          <ul className="mt-3 space-y-2">
            {CREDIT_PACKS.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="font-mono text-[13px] tabular-nums text-ink">
                  {p.sims.toLocaleString()} <span className="text-mut">· ${p.price}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => void buyPack(p.id, p.sims)}>
                  {st?.enabled ? "Buy" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Plan switcher */}
      <section className="mt-10">
        <Eyebrow>Change plan</Eyebrow>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {PLANS.map((p) => {
            const current = p.id === session.plan;
            return (
              <button
                key={p.id}
                type="button"
                disabled={current}
                onClick={() => void choosePlan(p.id)}
                className={`focus-ring rounded-lg border p-4 text-left transition-colors ${
                  current
                    ? "border-accent/50 bg-raised"
                    : "border-edge cursor-pointer hover:border-mut"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-ink">{p.name}</span>
                  {current && (
                    <span className="font-mono text-[9px] tracking-[0.14em] text-accent">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-[12px] tabular-nums text-sub">
                  {p.priceMonthly === null ? "$0" : `$${p.priceMonthly}/mo`} ·{" "}
                  {p.simsIncluded.toLocaleString()} sims
                </div>
              </button>
            );
          })}
        </div>
        {checkoutError && (
          <p className="mt-3 rounded-lg border border-warn/40 bg-warn/8 p-3 text-[13px] text-warn">
            {checkoutError}
          </p>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-mut">
          {st?.enabled
            ? "Payments are live — plans and token packs check out through Stripe, and the usage meter is the same ledger the server enforces. "
            : "V0 preview: plan switches and credit packs apply to this workspace instantly and nothing is charged — connecting Stripe activates real checkout with no code changes. Usage metering is real. "}{" "}
          <Link href="/pricing" className="focus-ring rounded text-accent hover:underline">
            Full pricing →
          </Link>
        </p>
      </section>
    </div>
  );
}
