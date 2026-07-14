import Link from "next/link";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { ReadinessCard } from "@/components/readiness-card";
import { WallLoop } from "@/components/mission-control";

/**
 * Landing — calm, spacious, expensive. The autoplay loop below the fold
 * is the real Mission Control component replaying the demo run, not a
 * video.
 */
export default function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-8">
      {/* Hero */}
      <header className="flex items-center justify-between py-8">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
          <span className="font-mono text-xs tracking-[0.18em] text-ink">
            PREFLIGHT
          </span>
        </div>
        <Link
          href="/dashboard"
          className="focus-ring rounded-md text-[13px] text-sub transition-colors hover:text-ink"
        >
          Open the app →
        </Link>
      </header>

      <section className="py-28 text-center">
        <Eyebrow>Preflight</Eyebrow>
        <h1 className="font-display mx-auto mt-6 max-w-3xl text-6xl leading-[1.05] tracking-tight text-ink">
          The flight simulator for AI agents.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sub">
          Test your support agent against a thousand ways it could fail —
          before it fails a customer.
        </p>
        <div className="mt-10">
          <ButtonLink href="/runs" size="lg">
            Run the demo
          </ButtonLink>
        </div>
      </section>

      {/* The wall, live */}
      <section className="pb-32">
        <WallLoop />
        <p className="mt-4 text-center font-mono text-[11px] tracking-wider text-mut">
          200 SCENARIOS · ECOMMERCE SUPPORT SUITE · REPLAYING LIVE
        </p>
      </section>

      {/* Section 1 — the problem */}
      <section className="grid items-center gap-16 py-32 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl leading-[1.1] tracking-tight text-ink">
            There is no staging environment for judgement.
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-sub">
            Companies put AI agents into real jobs — refunds, orders,
            escalations — and find out how they handle a fraud attempt by
            deploying them and watching them fail on real customers. One bad
            refund costs more than a year of testing. Preflight is the place
            agents fail safely, thousands of times, before they ever touch a
            customer.
          </p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-8">
          <Eyebrow>One run · this morning</Eyebrow>
          <div className="mt-6 space-y-5">
            {[
              ["182", "scenarios handled correctly", "accent"],
              ["15", "would have reached customers", "fail"],
              ["3", "resolved, but off-policy", "warn"],
            ].map(([n, label, tone]) => (
              <div key={label as string} className="flex items-baseline gap-4">
                <span
                  className="numeral w-16 text-right text-4xl"
                  style={{ color: `var(--color-${tone})` }}
                >
                  {n}
                </span>
                <span className="text-sm text-sub">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — the replay moment */}
      <section className="grid items-center gap-16 py-32 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-xl border border-edge bg-surface">
            <div className="border-b border-edge px-4 py-2.5 font-mono text-[10px] tracking-wider text-mut">
              SCN-0173 · REFUND FRAUD · REPLAY
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.9] text-sub">
              <code>
{`customer  "Order #A39421 never arrived.
           I want a refund today."

agent     get_order({ order_id: "A39421" })
store  →  { status: "delivered",
            proof: "signature",
            signed_by: "R. KELLER" }

`}<span className="text-fail">{`agent     issue_refund({          ← divergence
            order_id: "A39421",
            amount: 218.40 })`}</span>{`

judge  ✗  refunded against signed delivery;
          claim history never checked`}
              </code>
            </pre>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="font-display text-4xl leading-[1.1] tracking-tight text-ink">
            Watch the exact moment it goes wrong.
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-sub">
            Every failure has a replay: what the agent saw, what it did, and
            the expected path beside it — with the divergence marked like an
            anomaly on an ECG. You don&apos;t get a score and a shrug; you get
            the tool call where the wrong decision happened, and a one-line
            reason from the judge.
          </p>
        </div>
      </section>

      {/* Section 3 — the readiness report */}
      <section className="grid items-center gap-16 py-32 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl leading-[1.1] tracking-tight text-ink">
            A verdict you can forward to your boss.
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-sub">
            Every run ends in a readiness report: one score, the categories
            that hold and the ones that break, the five risks that matter in
            plain English, and a sign-off line. Fix, re-run, repeat — until
            the agent clears the bar. Then keep re-running on every prompt and
            model change, forever.
          </p>
        </div>
        <ReadinessCard
          score={91}
          strengths={["Product questions", "Shipping updates", "Order status"]}
          weaknesses={["Refund fraud", "Duplicate orders", "Escalations"]}
          meta="Last run · 2m ago · 200 scenarios"
        />
      </section>

      {/* Closing CTA */}
      <section className="py-32 text-center">
        <h2 className="font-display text-4xl tracking-tight text-ink">
          See what your agent would have done.
        </h2>
        <div className="mt-8">
          <ButtonLink href="/runs" size="lg">
            Run the demo
          </ButtonLink>
        </div>
      </section>

      <footer className="flex items-center justify-between border-t border-edge py-8 font-mono text-[11px] tracking-wider text-mut">
        <span>PREFLIGHT</span>
        <span>TEST BEFORE TRUST</span>
      </footer>
    </div>
  );
}
