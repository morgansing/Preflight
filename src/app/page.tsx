import Link from "next/link";
import { HeroAuthButtons } from "@/components/hero-auth-buttons";
import { LandingReveal } from "@/components/landing-reveal";
import { MarketingMetrics } from "@/components/marketing-metrics";
import { MarketingReplay } from "@/components/marketing-replay";
import { ReadinessCard } from "@/components/readiness-card";
import { WallLoop } from "@/components/mission-control";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { getReplay } from "@/lib/fixtures/replays";
import { failingReplayId, scenarioById } from "@/lib/fixtures/scenarios";
import styles from "./landing.module.css";

const proofPoints = [
  ["200", "base scenarios"],
  ["23", "Gauntlet stress cases"],
  ["10,000", "max sign-off run"],
];

const workflow = [
  {
    step: "01",
    kicker: "Connect",
    title: "Bring the agent you already have.",
    body: "Point Preflight at an HTTP endpoint or connect a supported agent. Your production code stays where it is; the simulator handles the pressure.",
    meta: "Endpoint · auth · tools",
  },
  {
    step: "02",
    kicker: "Define",
    title: "Turn your operating policy into a Rulebook.",
    body: "Start from help-centre pages, pasted docs, prompts, transcripts, or seven guided questions. Preflight drafts the rules; your team approves them.",
    meta: "Docs · prompts · transcripts",
  },
  {
    step: "03",
    kicker: "Stress",
    title: "Run the conversations you cannot risk.",
    body: "Coverage, The Gauntlet, prompt-injection attacks, and scenarios generated from your Rulebook run against the same agent and judge.",
    meta: "Coverage · security · policy",
  },
  {
    step: "04",
    kicker: "Prove",
    title: "Ship with evidence, not instinct.",
    body: "Replay every miss, compare against a pinned baseline, and share a verifiable readiness result with the people responsible for launch.",
    meta: "Replays · CI gate · report",
  },
];

const verdictLayers = [
  {
    label: "Root-cause clustering",
    title: "Turn 31 red cells into three problems",
    tone: "text-mut",
    body: (
      <>
        Preflight groups repeat failures by the decision that caused them,
        gives each cluster a plain-English diagnosis, and links the proof
        replays. Fix the problem instead of triaging the symptom list.
      </>
    ),
  },
  {
    label: "Adaptive red-team",
    title: "Its failures become its next exam",
    tone: "text-warn",
    body: (
      <>
        One click turns a run&apos;s failure patterns into a suite of escalating
        adversaries aimed at exactly what your agent got wrong. Fix, re-run,
        and the attacks move to the next weakness.
      </>
    ),
  },
  {
    label: "Proof you can share",
    title: "A badge that answers the question",
    tone: "text-accent",
    body: (
      <>
        Every run can publish a verifiable read-only result and embeddable
        score badge—gate pull requests on it in CI, place it in the README, or
        attach the PDF to the launch email. Transcripts stay private.
      </>
    ),
  },
];

const integrations = [
  ["OA", "OpenAI"],
  ["AZ", "Azure OpenAI"],
  ["LC", "LangChain"],
  ["CA", "CrewAI"],
  ["AI", "Vercel AI SDK"],
  ["V", "vLLM / TGI"],
  ["↗", "Custom HTTP"],
];

const replay = getReplay("SCN-0187");
const replayScenario = scenarioById.get("SCN-0187");

export default function Landing() {
  if (!replay || !replayScenario) return null;

  return (
    <main className={`${styles.page} min-h-screen overflow-hidden`}>
      <div aria-hidden className={styles.ambient}>
        <div className={styles.grid} />
        <div className={styles.signalField} />
        <div className={styles.orbOne} />
        <div className={styles.orbTwo} />
        <div className={styles.orbThree} />
        <div className={styles.noise} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-center justify-between py-7">
          <Link
            href="/"
            className="focus-ring group flex items-center gap-2 rounded-md"
            aria-label="Preflight home"
          >
            <span
              aria-hidden
              className="relative inline-flex size-2 rounded-full bg-accent shadow-[0_0_18px_rgba(61,220,132,0.65)]"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-30" />
            </span>
            <span className="font-mono text-xs tracking-[0.18em] text-ink transition-colors group-hover:text-accent">
              PREFLIGHT
            </span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Primary">
            <Link
              href="/product"
              className="focus-ring hidden rounded-md text-[13px] text-sub transition-colors hover:text-ink md:inline"
            >
              Product
            </Link>
            <Link
              href="/integrations"
              className="focus-ring hidden rounded-md text-[13px] text-sub transition-colors hover:text-ink lg:inline"
            >
              Integrations
            </Link>
            <Link
              href="/pricing"
              className="focus-ring hidden rounded-md text-[13px] text-sub transition-colors hover:text-ink sm:inline"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="focus-ring hidden rounded-md text-[13px] text-sub transition-colors hover:text-ink sm:inline"
            >
              Sign in
            </Link>
            <details className="relative sm:hidden">
              <summary className="focus-ring cursor-pointer list-none rounded-full border border-edge bg-surface/70 px-3 py-2 text-[12px] text-sub">
                Menu
              </summary>
              <div className="absolute right-0 top-12 z-30 grid w-44 gap-1 rounded-xl border border-edge bg-raised/95 p-2 text-left text-[13px] shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
                <Link href="/product" className="rounded-lg px-3 py-2 text-sub hover:bg-surface hover:text-ink">
                  Product
                </Link>
                <Link href="/integrations" className="rounded-lg px-3 py-2 text-sub hover:bg-surface hover:text-ink">
                  Integrations
                </Link>
                <Link href="/pricing" className="rounded-lg px-3 py-2 text-sub hover:bg-surface hover:text-ink">
                  Pricing
                </Link>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sub hover:bg-surface hover:text-ink">
                  Sign in
                </Link>
              </div>
            </details>
            <Link
              href="/dashboard"
              className="focus-ring rounded-full border border-edge bg-surface/70 px-4 py-2 text-[13px] text-ink backdrop-blur-xl transition-all hover:border-accent/40 hover:bg-raised"
            >
              Open the app <span aria-hidden>→</span>
            </Link>
          </nav>
        </header>

        <section className="relative pb-24 pt-20 text-center sm:pb-28 sm:pt-28">
          <div className={styles.heroKicker}>
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Evaluation infrastructure for production AI
          </div>
          <h1
            className={`${styles.heroTitle} font-display mx-auto mt-7 max-w-4xl text-5xl leading-[0.98] tracking-[-0.045em] text-ink sm:text-7xl lg:text-[5.4rem]`}
          >
            Know how your agent fails
            <span className={styles.heroAccent}> before your users do.</span>
          </h1>
          <p
            className={`${styles.heroCopy} mx-auto mt-7 max-w-2xl text-base leading-relaxed text-sub sm:text-lg`}
          >
            Preflight puts AI agents through realistic conversations,
            adversarial edge cases, and your own operating policies—then shows
            you the exact decision that broke.
          </p>

          <div className={`${styles.heroActions} mx-auto mt-10 max-w-xl`}>
            <HeroAuthButtons />
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-edge/80" />
              <span className="font-mono text-[9px] tracking-[0.16em] text-mut">
                OR EXPLORE FIRST
              </span>
              <span className="h-px flex-1 bg-edge/80" />
            </div>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row">
              <ButtonLink
                href="/runs"
                size="lg"
                className="group min-w-36 shadow-[0_0_30px_rgba(61,220,132,0.12)]"
              >
                Run the demo
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </ButtonLink>
              <ButtonLink
                href="/signup"
                size="lg"
                variant="secondary"
                className="min-w-36 bg-surface/60 backdrop-blur"
              >
                Start free
              </ButtonLink>
            </div>
            <p className="mt-4 text-[12px] text-mut">
              First 250 simulations free · no credit card required
            </p>
          </div>

          <div
            className={`${styles.signalMarquee} mx-auto mt-14 max-w-3xl`}
            aria-label="Evaluation areas"
          >
            <div className={styles.signalTrack}>
              {[
                "Tool calls",
                "Policy adherence",
                "Prompt injection",
                "Escalations",
                "Regression",
                "Tool calls",
                "Policy adherence",
                "Prompt injection",
                "Escalations",
                "Regression",
              ].map((item, index) => (
                <span key={`${item}-${index}`} className="flex items-center gap-3">
                  <span className="size-1 rounded-full bg-accent/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <LandingReveal>
          <section className={styles.liveShell} aria-labelledby="live-run-title">
            <div className="flex flex-col gap-4 border-b border-edge/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-40" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                <div>
                  <p
                    id="live-run-title"
                    className="font-mono text-[10px] tracking-[0.16em] text-ink"
                  >
                    LIVE EVALUATION
                  </p>
                  <p className="mt-1 text-xs text-mut">
                    Ecommerce support suite · run 0472
                  </p>
                </div>
              </div>
              <div className="flex gap-5 font-mono text-[10px] tracking-wider text-mut">
                <span>
                  <strong className="font-normal text-accent">194</strong> pass
                </span>
                <span>
                  <strong className="font-normal text-fail">4</strong> fail
                </span>
                <span>
                  <strong className="font-normal text-warn">2</strong> review
                </span>
              </div>
            </div>
            <div className="relative p-3 sm:p-5">
              <div className={styles.scanLine} aria-hidden />
              <WallLoop />
            </div>
            <p className="border-t border-edge/80 px-5 py-3 text-center font-mono text-[10px] tracking-[0.14em] text-mut">
              200 SCENARIOS · REPLAYING FROM A VERIFIED DEMO RUN
            </p>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section
            className="grid border-x border-b border-edge/70 bg-surface/30 sm:grid-cols-3"
            aria-label="Preflight at a glance"
          >
            {proofPoints.map(([value, label], index) => (
              <div
                key={label}
                className={`flex items-baseline gap-3 px-6 py-6 sm:block sm:text-center ${
                  index > 0 ? "border-t border-edge/70 sm:border-l sm:border-t-0" : ""
                }`}
              >
                <div className="numeral text-3xl text-ink sm:text-4xl">{value}</div>
                <div className="mt-1 text-xs text-mut">{label}</div>
              </div>
            ))}
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="py-20 sm:py-24" aria-labelledby="integration-title">
            <div className="text-center">
              <Eyebrow>Meet your agent where it runs</Eyebrow>
              <h2
                id="integration-title"
                className="font-display mt-4 text-3xl tracking-tight text-ink sm:text-4xl"
              >
                One test layer. The stack you already chose.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-sub">
                Connect an OpenAI-compatible backend or your own HTTP endpoint.
                Preflight supplies the store tools, drives the multi-turn
                conversation, and judges the path—without moving your agent.
              </p>
            </div>
            <div
              className={`${styles.integrationRail} mt-10`}
              aria-label="Compatible agent stacks"
            >
              <div className={styles.integrationTrack} aria-hidden>
                {[...integrations, ...integrations].map(([mark, name], index) => (
                  <div className={styles.integrationItem} key={`${name}-${index}`}>
                    <span className={styles.integrationMark}>{mark}</span>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/integrations"
                className="focus-ring inline-flex items-center gap-2 rounded-md text-sm text-accent transition-colors hover:text-accent-hover"
              >
                See every connection path <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="grid items-center gap-12 py-28 lg:grid-cols-[1fr_0.9fr] lg:gap-20 lg:py-36">
            <div>
              <Eyebrow>The launch gap</Eyebrow>
              <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
                There is no staging environment for judgement.
              </h2>
              <p className="mt-6 max-w-xl text-[15px] leading-7 text-sub">
                Teams put AI agents into real jobs—refunds, orders,
                escalations—and discover how they handle fraud by watching
                them fail on real customers. Preflight is the place agents
                fail safely, thousands of times, before they touch production.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Real tool paths", "Policy-aware judges", "Replayable evidence"].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-edge bg-surface/60 px-3 py-1.5 font-mono text-[10px] tracking-wide text-sub"
                    >
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
            <MarketingMetrics />
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.sectionShell}>
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow>Replay, not guesswork</Eyebrow>
              <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
                Watch the exact moment it goes wrong.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-7 text-sub">
                Every failure has a replay: what the agent saw, what it did,
                and the expected path beside it—with the divergence marked
                like an anomaly on an ECG. Press any step below to inspect the
                evidence yourself.
              </p>
            </div>
            <div className="mt-12">
              <MarketingReplay replay={replay} scenario={replayScenario} />
            </div>
            <div className="mt-6 flex flex-col justify-between gap-4 border-x border-b border-edge/70 bg-surface/35 px-5 py-4 text-sm sm:flex-row sm:items-center">
              <p className="max-w-3xl leading-6 text-sub">
                <span className="font-medium text-ink">Judge diagnosis:</span>{" "}
                {replay.failureReason}
              </p>
              <Link
                href="/replay/SCN-0187"
                className="focus-ring shrink-0 rounded-md text-accent transition-colors hover:text-accent-hover"
              >
                Open full replay →
              </Link>
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="grid items-center gap-12 py-28 lg:grid-cols-[0.86fr_1.14fr] lg:gap-20 lg:py-36">
            <div>
              <Eyebrow>The Gauntlet</Eyebrow>
              <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
                Harder, not bigger.
              </h2>
              <p className="mt-6 max-w-xl text-[15px] leading-7 text-sub">
                Standard and larger runs already include 23 difficulty-4/5
                scenarios built around the mistakes that cost money or demand
                a human: refund fraud, payment-retry duplicates, legal threats,
                safety complaints, and above-limit approvals.
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-sub">
                After a fix, rerun just the hard slice. Then send 16
                prompt-injection attacks through store data to prove your agent
                can tell instructions from evidence.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "12 refund-fraud",
                  "3 duplicate-order",
                  "8 escalation",
                  "16 security attacks",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-edge bg-surface/60 px-3 py-1.5 font-mono text-[10px] tracking-wide text-sub"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <Link
                href="/product"
                className="focus-ring mt-7 inline-flex items-center gap-2 rounded-md text-sm text-accent transition-colors hover:text-accent-hover"
              >
                Explore every evaluation layer <span aria-hidden>→</span>
              </Link>
            </div>

            <div className={styles.gauntletCard}>
              <div className={styles.gauntletHeader}>
                <div>
                  <span className={styles.gauntletMark}>G</span>
                  <span className="font-mono text-[10px] tracking-[0.14em] text-warn">
                    THE GAUNTLET
                  </span>
                </div>
                <span className="font-mono text-[9px] tracking-[0.13em] text-mut">
                  23 SCENARIOS · LIVE SLICE
                </span>
              </div>
              <div className={styles.difficultyRamp}>
                {[
                  ["01", "ROUTINE"],
                  ["02", "NUANCED"],
                  ["03", "TRICKY"],
                  ["04", "HARD"],
                  ["05", "BRUTAL"],
                ].map(([level, label], index) => (
                  <div
                    key={level}
                    className={`${styles.difficultyStep} ${
                      index >= 3 ? styles.difficultyActive : ""
                    }`}
                  >
                    <span>{level}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>
              <div className={styles.gauntletBody}>
                <div className={styles.gauntletSummary}>
                  <div>
                    <span className="numeral text-4xl text-warn">7</span>
                    <span>Hard</span>
                  </div>
                  <div>
                    <span className="numeral text-4xl text-fail">16</span>
                    <span>Brutal</span>
                  </div>
                  <div>
                    <span className="numeral text-4xl text-ink">23</span>
                    <span>Total</span>
                  </div>
                </div>
                <div className={styles.gauntletGrid} aria-hidden>
                  {Array.from({ length: 23 }, (_, index) => (
                    <span
                      key={index}
                      className={index < 7 ? styles.hardCell : styles.brutalCell}
                      style={{ animationDelay: `${(index % 8) * 170}ms` }}
                    >
                      {index % 6 === 0 ? "!" : index % 4 === 0 ? "×" : "·"}
                    </span>
                  ))}
                </div>
                <div className={styles.gauntletCategories}>
                  {[
                    ["Refund fraud", "12"],
                    ["Duplicate orders", "03"],
                    ["Escalations", "08"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.securityStrip}>
                <span className={styles.securityPulse} aria-hidden />
                <div>
                  <span>SECURITY SIDE RUN</span>
                  <strong>Store data is data—not instructions.</strong>
                </div>
                <b>16 ATTACKS</b>
              </div>
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="grid items-center gap-12 py-28 lg:grid-cols-2 lg:gap-20 lg:py-36">
            <div>
              <Eyebrow>Decision-ready output</Eyebrow>
              <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-tight text-ink sm:text-5xl">
                A verdict you can forward to your boss.
              </h2>
              <p className="mt-6 text-[15px] leading-7 text-sub">
                Every run ends in a readiness report: one score, the categories
                that hold and break, the five risks that matter in plain
                English, and a sign-off line. Fix, re-run, repeat—then keep
                testing on every prompt and model change.
              </p>
              <Link
                href="/share/demo"
                className="focus-ring mt-7 inline-flex items-center gap-2 rounded-md text-sm text-accent transition-colors hover:text-accent-hover"
              >
                Open the verified demo report <span aria-hidden>→</span>
              </Link>
            </div>
            <div className={styles.reportFloat}>
              <ReadinessCard
                score={97}
                strengths={["Product questions", "Shipping updates", "Order status"]}
                weaknesses={["Refund fraud", "Duplicate orders", "Escalations"]}
                meta="Last run · 2m ago · 200 scenarios"
                hrefs={Object.fromEntries(
                  ["Refund fraud", "Duplicate orders", "Escalations"].map(
                    (weakness) => {
                      const id = failingReplayId(weakness);
                      return [weakness, id && `/replay/${id}`];
                    },
                  ),
                )}
              />
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="pb-16 pt-8 sm:pb-24">
            <div className="max-w-2xl">
              <Eyebrow>One clear path to confidence</Eyebrow>
              <h2 className="font-display mt-4 text-4xl tracking-tight text-ink sm:text-5xl">
                From endpoint to evidence in one run.
              </h2>
              <p className="mt-5 text-[15px] leading-7 text-sub">
                Preflight fits around the agent you have today and turns testing
                into a repeatable release gate.
              </p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-edge bg-edge md:grid-cols-2 xl:grid-cols-4">
              {workflow.map((item) => (
                <article
                  key={item.step}
                  className={`${styles.workflowCard} relative bg-surface p-7 sm:p-8`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-accent">
                      {item.step} / {item.kicker.toUpperCase()}
                    </span>
                    <span className="numeral text-3xl text-edge">{item.step}</span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium leading-snug text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-sub">{item.body}</p>
                  <p className="mt-8 border-t border-edge pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-mut">
                    {item.meta}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className="py-24 sm:py-32">
            <div className="text-center">
              <Eyebrow>Beyond the score</Eyebrow>
              <h2 className="font-display mt-4 text-4xl tracking-tight text-ink sm:text-5xl">
                A score is only the beginning.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-sub">
                Go from a headline number to the evidence, attack surface, and
                release proof behind it.
              </p>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {verdictLayers.map((layer, index) => (
                <article
                  key={layer.label}
                  className={`${styles.featureCard} rounded-2xl border border-edge bg-surface/80 p-7 shadow-card backdrop-blur-sm`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`font-mono text-[10px] tracking-[0.14em] ${layer.tone}`}
                    >
                      {layer.label.toUpperCase()}
                    </div>
                    <span className="font-mono text-[10px] text-mut">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[17px] font-medium text-ink">
                    {layer.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-sub">{layer.body}</p>
                  {index === 2 && (
                    <span className="mt-5 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/api/badge/demo"
                        alt="Preflight score badge: 97"
                        className="h-5"
                      />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={`${styles.closingCta} my-20 overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12 sm:py-24`}>
            <div aria-hidden className={styles.closingGlow} />
            <div className="relative">
              <Eyebrow className="text-accent">Your agent has a blind spot</Eyebrow>
              <h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl tracking-tight text-ink sm:text-5xl">
                Find it before a customer does.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-sub">
                Run the full demo in under two minutes. No setup, no credit
                card, and every failure comes with a replay.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink href="/runs" size="lg" className="min-w-36">
                  Run the demo
                </ButtonLink>
                <ButtonLink
                  href="/signup"
                  size="lg"
                  variant="secondary"
                  className="min-w-36 bg-bg/40"
                >
                  Start free
                </ButtonLink>
              </div>
            </div>
          </section>
        </LandingReveal>

        <footer className="flex flex-col gap-4 border-t border-edge py-8 font-mono text-[10px] tracking-[0.14em] text-mut sm:flex-row sm:items-center sm:justify-between">
          <span>PREFLIGHT · TEST BEFORE TRUST</span>
          <div className="flex items-center gap-5">
            <Link href="/product" className="transition-colors hover:text-ink">
              PRODUCT
            </Link>
            <Link href="/integrations" className="transition-colors hover:text-ink">
              INTEGRATIONS
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-ink">
              PRICING
            </Link>
            <Link href="/login" className="transition-colors hover:text-ink">
              SIGN IN
            </Link>
            <span>© 2026</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
