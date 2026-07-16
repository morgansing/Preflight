"use client";

import Link from "next/link";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { CREDIT_PACKS, PLANS } from "@/lib/billing";

/**
 * Pricing: the unit is the simulation, not the seat and not the day.
 * Free is 250 simulations (see your agent fail before paying anything);
 * plans are monthly allowances so testing becomes part of the workflow;
 * overage is prepaid packs or opt-in automatic billing.
 */

const WORKFLOW = ["Build", "Test", "Fix", "Rerun", "Ship"];

const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as one simulation?",
    a: "One scenario, run once: a full multi-turn conversation between the simulated customer and your agent, driving real store tools, judged against the rubric. A Standard run (200 scenarios) uses 200 simulations. Rerunning it uses 200 more.",
  },
  {
    q: "Do unused simulations roll over?",
    a: "Monthly plan allowances reset each cycle — they're priced for a testing habit, not for hoarding. Credit packs never expire and are drawn down only after your monthly allowance runs out.",
  },
  {
    q: "What about my agent's own LLM costs?",
    a: "Your agent runs on your infrastructure with your keys — Preflight never pays (or marks up) your model bill. Simulations cover Preflight's side: the simulated store, the customer persona, the judge, replays, reports, baselines and the CI gate.",
  },
  {
    q: "What happens when I run out mid-month?",
    a: "Runs never die mid-wall. If a run would exceed your balance, Preflight tells you before it starts — buy a pack, enable auto-overage, or pick a smaller tier.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-md">
          <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
          <span className="font-mono text-xs tracking-[0.18em] text-ink">PREFLIGHT</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/login" className="focus-ring rounded text-[13px] text-sub hover:text-ink">
            Sign in
          </Link>
          <ButtonLink href="/signup" size="sm">
            Start free
          </ButtonLink>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-8 pb-24">
        {/* Hero */}
        <div className="mx-auto max-w-2xl pt-14 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="font-display mt-4 text-5xl leading-[1.1] tracking-tight text-ink">
            Pay per simulation.
            <br />
            Not per seat, not per day.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-sub">
            One simulation = one scenario run against your agent, judged. Your first{" "}
            <span className="text-ink">250 are free — no credit card</span> — because the fastest
            way to understand Preflight is watching your own agent fail.
          </p>
        </div>

        {/* Plans */}
        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const featured = plan.id === "team";
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col p-6 ${
                  featured ? "border-accent/50 bg-raised" : ""
                }`}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-6 rounded border border-accent/40 bg-surface px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-accent">
                    MOST TEAMS
                  </span>
                )}
                <div className="text-[15px] font-medium text-ink">{plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  {plan.priceMonthly === null ? (
                    <span className="font-display text-4xl text-ink">$0</span>
                  ) : (
                    <>
                      <span className="font-display text-4xl text-ink">
                        ${plan.priceMonthly.toLocaleString()}
                      </span>
                      <span className="text-sm text-mut">/mo</span>
                    </>
                  )}
                </div>
                <div className="mt-2 font-mono text-[12px] tabular-nums text-sub">
                  {plan.simsIncluded.toLocaleString()} simulations
                  {plan.priceMonthly === null ? " · one-time" : " / month"}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-sub">{plan.tagline}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[13px] leading-snug text-sub">
                      <span aria-hidden className="mt-0.5 text-accent">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink
                    href="/signup"
                    variant={featured ? "primary" : "secondary"}
                    className="w-full"
                  >
                    {plan.priceMonthly === null ? "Start free" : `Start with ${plan.name}`}
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Overage */}
        <section className="mx-auto mt-20 max-w-4xl">
          <div className="text-center">
            <Eyebrow>When you need more</Eyebrow>
            <h2 className="font-display mt-3 text-3xl tracking-tight text-ink">
              Run past your allowance, your way
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <div className="text-[15px] font-medium text-ink">Credit packs</div>
              <p className="mt-2 text-[13px] leading-relaxed text-sub">
                Prepaid, never expire, drawn down after your monthly allowance. Predictable for
                procurement.
              </p>
              <ul className="mt-4 space-y-2">
                {CREDIT_PACKS.map((p) => (
                  <li
                    key={p.sims}
                    className="flex items-baseline justify-between border-b border-edge pb-2 font-mono text-[13px] tabular-nums last:border-0"
                  >
                    <span className="text-ink">{p.sims.toLocaleString()} simulations</span>
                    <span className="text-sub">${p.price.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <div className="text-[15px] font-medium text-ink">Automatic overage</div>
              <p className="mt-2 text-[13px] leading-relaxed text-sub">
                Opt-in, off by default. Keep shipping through a heavy month and settle the extra
                per 1,000 simulations at your plan&apos;s rate — no run ever blocks on a purchase
                order.
              </p>
              <ul className="mt-4 space-y-2">
                {PLANS.filter((p) => p.overagePer1k).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline justify-between border-b border-edge pb-2 font-mono text-[13px] tabular-nums last:border-0"
                  >
                    <span className="text-ink">{p.name}</span>
                    <span className="text-sub">${p.overagePer1k} / extra 1,000</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* Why subscriptions, not PAYG */}
        <section className="mx-auto mt-20 max-w-3xl rounded-xl border border-edge bg-surface p-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[13px] tracking-wide">
            {WORKFLOW.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className={step === "Test" || step === "Rerun" ? "text-accent" : "text-sub"}>
                  {step}
                </span>
                {i < WORKFLOW.length - 1 && (
                  <span aria-hidden className="text-mut">
                    →
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-sub">
            Preflight is priced as an allowance instead of pay-as-you-go on purpose: readiness
            isn&apos;t a one-off audit before launch, it&apos;s the test suite your agent runs
            every time it changes. The plans are sized so rerunning after every fix is the
            default, not a decision.
          </p>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="font-display text-center text-3xl tracking-tight text-ink">
            The fine print, plainly
          </h2>
          <div className="mt-8 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="border-l-2 border-edge pl-6">
                <h3 className="text-[15px] font-medium text-ink">{item.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sub">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <ButtonLink href="/signup" size="lg">
            Run your first 250 simulations free
          </ButtonLink>
          <p className="mt-3 text-[12px] text-mut">No credit card. Your replays are yours.</p>
        </div>
      </main>
    </div>
  );
}
