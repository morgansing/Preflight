import Link from "next/link";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { ReadinessCard } from "@/components/readiness-card";
import { WallLoop } from "@/components/mission-control";
import { failingReplayId } from "@/lib/fixtures/scenarios";

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
        <nav className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="focus-ring rounded-md text-[13px] text-sub transition-colors hover:text-ink"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="focus-ring rounded-md text-[13px] text-sub transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="focus-ring rounded-md text-[13px] text-sub transition-colors hover:text-ink"
          >
            Open the app →
          </Link>
        </nav>
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
        <div className="mt-10 flex items-center justify-center gap-3">
          <ButtonLink href="/runs" size="lg">
            Run the demo
          </ButtonLink>
          <ButtonLink href="/signup" size="lg" variant="secondary">
            Start free
          </ButtonLink>
        </div>
        <p className="mt-4 text-[12px] text-mut">
          First 250 simulations free · no credit card required
        </p>
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
              ["194", "scenarios handled correctly", "accent"],
              ["4", "would have reached customers", "fail"],
              ["2", "resolved, but off-policy", "warn"],
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
          score={97}
          strengths={["Product questions", "Shipping updates", "Order status"]}
          weaknesses={["Refund fraud", "Duplicate orders", "Escalations"]}
          meta="Last run · 2m ago · 200 scenarios"
          hrefs={Object.fromEntries(
            ["Refund fraud", "Duplicate orders", "Escalations"].map((w) => {
              const id = failingReplayId(w);
              return [w, id && `/replay/${id}`];
            }),
          )}
        />
      </section>

      {/* What ships with it — the layers behind the verdict. */}
      <section className="py-32">
        <div className="text-center">
          <Eyebrow>Beyond the score</Eyebrow>
          <h2 className="font-display mt-3 text-4xl tracking-tight text-ink">
            A score is only the beginning.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-edge bg-surface p-7 shadow-card">
            <div className="font-mono text-[10px] tracking-[0.14em] text-mut">LAYERED VERDICT</div>
            <h3 className="mt-3 text-[17px] font-medium text-ink">
              Coverage · security · your policies
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-sub">
              A production sign-off runs the scenario library, a prompt-injection
              suite, and scenarios generated from <em>your</em>{" "}rulebook — one job,
              one checklist verdict. Every report says out loud what it did and
              didn&apos;t test.
            </p>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-7 shadow-card">
            <div className="font-mono text-[10px] tracking-[0.14em] text-warn">ADAPTIVE RED-TEAM</div>
            <h3 className="mt-3 text-[17px] font-medium text-ink">
              Its failures become its next exam
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-sub">
              One click turns a run&apos;s failure patterns into a suite of escalating
              adversaries aimed at exactly what your agent got wrong. Fix, re-run,
              and the attacks move to the next weakness.
            </p>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-7 shadow-card">
            <div className="font-mono text-[10px] tracking-[0.14em] text-accent">PROOF YOU CAN SHARE</div>
            <h3 className="mt-3 text-[17px] font-medium text-ink">
              A badge that answers the question
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-sub">
              Every run can mint a verified public result page and an embeddable
              score badge — gate PRs on it in CI, put it in the README, attach the
              PDF to the launch email.
            </p>
            <span className="mt-4 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/badge/demo" alt="Preflight score badge: 97" className="h-5" />
            </span>
          </div>
        </div>
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
