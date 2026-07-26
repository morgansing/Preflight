import Link from "next/link";
import { HeroAuthButtons } from "@/components/hero-auth-buttons";
import { LandingReveal } from "@/components/landing-reveal";
import { MarketingMetrics } from "@/components/marketing-metrics";
import { MarketingReadiness } from "@/components/marketing-readiness";
import { MarketingReplayPreview } from "@/components/marketing-replay-preview";
import { WallLoop } from "@/components/mission-control";
import { ButtonLink } from "@/components/ui";
import styles from "./landing.module.css";

const coverageStops = [
  ["01", "Fast signal", "24", "Every category, including policy traps"],
  ["02", "Base evidence", "200", "The complete hand-shaped scenario suite"],
  ["03", "Full pressure", "10,000", "Deterministic variation at launch depth"],
];

const workflow = [
  {
    step: "01",
    kicker: "Connect",
    title: "Bring the agent you already have.",
    body: "Point Preflight at an OpenAI-compatible or custom HTTP endpoint. Your production code stays where it is.",
    meta: "Endpoint · auth · tools",
  },
  {
    step: "02",
    kicker: "Define",
    title: "Turn operating policy into a Rulebook.",
    body: "Start from help-centre pages, docs, prompts, transcripts, or seven guided questions. Your team approves every rule.",
    meta: "Docs · prompts · transcripts",
  },
  {
    step: "03",
    kicker: "Stress",
    title: "Run the conversations you cannot risk.",
    body: "Coverage, The Gauntlet, prompt-injection attacks, and Rulebook scenarios run against the same agent and judge.",
    meta: "Coverage · security · policy",
  },
  {
    step: "04",
    kicker: "Prove",
    title: "Ship with evidence, not instinct.",
    body: "Replay every miss, compare a pinned baseline, and share a verifiable readiness result with the launch team.",
    meta: "Replay · CI gate · report",
  },
];

const verdictLayers = [
  {
    number: "01",
    label: "Root-cause clustering",
    title: "Turn 31 red cells into three problems.",
    body: "Repeated failures are grouped by the decision that caused them, with a plain-English diagnosis and proof replays for each cluster.",
  },
  {
    number: "02",
    label: "Adaptive red-team",
    title: "Its failures become its next exam.",
    body: "Turn a run's failure clusters into escalating adversaries aimed at exactly where the agent already cracked.",
  },
  {
    number: "03",
    label: "Shareable proof",
    title: "A result the launch team can inspect.",
    body: "Publish a read-only result, embed the score badge, gate pull requests in CI, or attach the PDF to the sign-off.",
  },
];

const integrations = [
  ["OA", "OpenAI-compatible"],
  ["AZ", "Azure OpenAI"],
  ["LC", "LangChain"],
  ["CR", "CrewAI"],
  ["AI", "Vercel AI SDK"],
  ["VL", "vLLM / TGI"],
  ["HTTP", "Custom endpoint"],
];

function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Preflight home">
        <span className={styles.brandSignal} aria-hidden />
        <span>PREFLIGHT</span>
      </Link>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link href="/" aria-current="page">
          Home
        </Link>
        <Link href="/product">Product</Link>
        <Link href="/integrations">Integrations</Link>
        <Link href="/pricing">Pricing</Link>
      </nav>
      <Link href="/signup" className={styles.headerCta}>
        Start free <span aria-hidden>→</span>
      </Link>
    </header>
  );
}

function SectionLabel({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sectionLabel}>
      <span>{number}</span>
      {children}
    </div>
  );
}

export default function Landing() {
  return (
    <main className={styles.page}>
      <div aria-hidden className={styles.ambient}>
        <div className={styles.grid} />
        <div className={styles.signalField} />
        <div className={styles.orbOne} />
        <div className={styles.orbTwo} />
        <div className={styles.orbThree} />
        <div className={styles.noise} />
      </div>

      <div className={styles.shell}>
        <Header />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span aria-hidden />
              Evaluation infrastructure for production AI
            </div>
            <h1>
              Know how your agent fails
              <br />
              <em>before your users do.</em>
            </h1>
            <p>
              Preflight puts AI agents through realistic conversations,
              adversarial edge cases, and your own operating policies—then
              shows you the exact decision that broke.
            </p>

            <div className={styles.authShell}>
              <HeroAuthButtons />
            </div>

            <div className={styles.exploreDivider}>
              <span />
              <small>OR EXPLORE FIRST</small>
              <span />
            </div>

            <div className={styles.heroActions}>
              <ButtonLink href="/runs" size="lg" className={styles.runButton}>
                Run the demo <span aria-hidden>→</span>
              </ButtonLink>
              <ButtonLink
                href="/signup"
                size="lg"
                variant="secondary"
                className={styles.secondaryButton}
              >
                Start free
              </ButtonLink>
            </div>
            <p className={styles.freeNote}>
              First 250 simulations free · no credit card required
            </p>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroGrid} aria-hidden />
            <div className={styles.liveShell} aria-labelledby="live-run-title">
              <div className={styles.liveHeader}>
                <div>
                  <span className={styles.livePulse} aria-hidden />
                  <p id="live-run-title">LIVE EVALUATION</p>
                </div>
                <span>RUN 0472 · STANDARD</span>
              </div>
              <div className={styles.liveStats}>
                <span>
                  <strong>194</strong>
                  PASS
                </span>
                <span>
                  <strong>4</strong>
                  FAIL
                </span>
                <span>
                  <strong>2</strong>
                  REVIEW
                </span>
                <span>
                  <strong>200</strong>
                  TOTAL
                </span>
              </div>
              <div className={styles.wallFrame}>
                <div className={styles.scanLine} aria-hidden />
                <WallLoop />
              </div>
              <div className={styles.liveFooter}>
                <span>ECOMMERCE SUPPORT SUITE</span>
                <span>VERIFIED DEMO RUN</span>
              </div>
            </div>
            <div className={styles.heroTelemetry} aria-hidden>
              <span>POLICY SIGNAL · 97.0</span>
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>

        <section className={styles.scaleBand} aria-label="Simulation run depths">
          <div className={styles.scaleBandLabel}>
            <span>RUN DEPTH</span>
            <small>One standard. More evidence.</small>
          </div>
          {[
            ["Smoke", "24", "fast signal"],
            ["Standard", "200", "full base suite"],
            ["Sign-off", "10,000", "maximum depth"],
          ].map(([name, count, note]) => (
            <div className={styles.scaleBandItem} key={name}>
              <span>{name}</span>
              <strong>{count}</strong>
              <small>{note}</small>
            </div>
          ))}
        </section>

        <LandingReveal>
          <section className={styles.integrationStrip}>
            <div className={styles.integrationLead}>
              <SectionLabel number="00">Meet your agent where it runs</SectionLabel>
              <p>
                OpenAI-compatible or custom HTTP. Framework backends connect
                through the same two endpoint contracts.
              </p>
            </div>
            <div className={styles.integrationRail} aria-label="Endpoint-ready stacks">
              <div className={styles.integrationTrack} aria-hidden>
                {[...integrations, ...integrations].map(([mark, name], index) => (
                  <div className={styles.integrationItem} key={`${name}-${index}`}>
                    <span>{mark}</span>
                    {name}
                  </div>
                ))}
              </div>
            </div>
            <Link href="/integrations" className={styles.textLink}>
              See connection paths <span aria-hidden>→</span>
            </Link>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.splitSection}>
            <div className={styles.sectionCopy}>
              <SectionLabel number="01">The launch gap</SectionLabel>
              <h2>
                There is no staging environment
                <br />
                <em>for judgement.</em>
              </h2>
              <p>
                Teams put agents into real jobs—refunds, orders,
                escalations—and discover how they handle fraud by watching
                them fail on real customers. Preflight is where those decisions
                fail safely first.
              </p>
              <div className={styles.pillRow}>
                <span>Real tool paths</span>
                <span>Policy-aware judges</span>
                <span>Replayable evidence</span>
              </div>
            </div>
            <div className={styles.productVisual}>
              <MarketingMetrics />
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={`${styles.splitSection} ${styles.replaySection}`}>
            <div className={styles.sectionCopy}>
              <SectionLabel number="02">Replay, not guesswork</SectionLabel>
              <h2>
                Watch the exact moment
                <br />
                <em>it goes wrong.</em>
              </h2>
              <p>
                See what the agent saw, what it did, and the expected path
                beside it. The divergence is marked like an anomaly on an ECG,
                with the tool call and judge diagnosis attached.
              </p>
              <p>
                Step through the real evidence below. Every cell on the wall
                opens a replay like this one.
              </p>
              <Link href="/replay/SCN-0187" className={styles.textLink}>
                Open the full replay <span aria-hidden>→</span>
              </Link>
            </div>
            <div className={styles.replayVisual}>
              <MarketingReplayPreview />
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.coverageSection}>
            <div className={styles.coverageCopy}>
              <SectionLabel number="03">Coverage that scales</SectionLabel>
              <h2>
                24 to 10,000
                <br />
                <em>real decisions.</em>
              </h2>
              <p>
                Start with a fast signal, run the full hand-shaped suite, then
                turn up the pressure for launch sign-off.
              </p>
              <Link href="/product#coverage" className={styles.textLink}>
                Explore coverage depth <span aria-hidden>→</span>
              </Link>
            </div>

            <div className={styles.coverageConsole}>
              <div className={styles.coverageConsoleTop}>
                <span>SCENARIO PRESSURE</span>
                <span>SELECT THE EVIDENCE DEPTH</span>
              </div>
              <div className={styles.coverageMatrix} aria-hidden>
                {Array.from({ length: 36 }, (_, index) => (
                  <i key={index} style={{ "--cell": index } as React.CSSProperties} />
                ))}
              </div>
              <div className={styles.coverageStops}>
                {coverageStops.map(([number, name, count, note]) => (
                  <article key={count}>
                    <div>
                      <span>{number}</span>
                      <span>{name}</span>
                    </div>
                    <strong>{count}</strong>
                    <p>{note}</p>
                  </article>
                ))}
              </div>
              <div className={styles.coverageTrack} aria-hidden>
                <span />
                <i />
                <i />
                <i />
              </div>
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={`${styles.splitSection} ${styles.gauntletSection}`}>
            <div className={styles.gauntletCard}>
              <div className={styles.gauntletHeader}>
                <div>
                  <span className={styles.gauntletMark}>G</span>
                  <span>THE GAUNTLET</span>
                </div>
                <span>23 SCENARIOS · LIVE SLICE</span>
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
                    <span>7</span>
                    <small>Hard</small>
                  </div>
                  <div>
                    <span>16</span>
                    <small>Brutal</small>
                  </div>
                  <div>
                    <span>23</span>
                    <small>Total</small>
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
              </div>
              <div className={styles.securityStrip}>
                <span className={styles.securityPulse} aria-hidden />
                <div>
                  <span>SECURITY SIDE RUN</span>
                  <strong>Attacks are hidden inside store data.</strong>
                </div>
                <b>16 ATTACKS</b>
              </div>
            </div>

            <div className={styles.sectionCopy}>
              <SectionLabel number="04">Harder, not bigger</SectionLabel>
              <h2>
                Skip the warm-up.
                <br />
                <em>Run the hard decisions.</em>
              </h2>
              <p>
                The Gauntlet isolates the 23 difficulty 4–5 scenarios already
                included in Standard and larger runs: boundary collisions,
                conflicting evidence, fraud, legal threats, and decisions that
                should demand a human.
              </p>
              <p>
                Rerun that hard slice alone after a fix. Then send 16
                prompt-injection attacks through the store data your agent
                reads, while the visible customer request stays ordinary.
              </p>
              <Link href="/product" className={styles.textLink}>
                Explore every evaluation layer <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.splitSection}>
            <div className={styles.sectionCopy}>
              <SectionLabel number="05">Decision-ready output</SectionLabel>
              <h2>
                A verdict you can forward
                <br />
                <em>with the evidence intact.</em>
              </h2>
              <p>
                Every run ends with a readiness report: score and confidence
                interval, strengths, weaknesses, root-cause clusters, the risks
                that matter, and an explicit account of what the run covered.
              </p>
              <p>
                Pin a passing baseline, compare newly broken and newly fixed
                behaviour, then gate the next prompt or model change in GitHub.
              </p>
              <Link href="/share/demo" className={styles.textLink}>
                Open the verified demo report <span aria-hidden>→</span>
              </Link>
            </div>
            <div className={styles.reportVisual}>
              <MarketingReadiness
                score={97}
                threshold={90}
                confidence={[94, 99]}
                baselineScore={94.6}
                regressions={0}
                scenarios={200}
                reportHref="/share/demo"
              />
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.workflowSection}>
            <div className={styles.workflowHeading}>
              <div className={styles.sectionCopy}>
                <SectionLabel number="06">One clear flight path</SectionLabel>
                <h2>
                  From endpoint to evidence
                  <br />
                  <em>in one repeatable run.</em>
                </h2>
              </div>
              <p>
                Preflight fits around the agent you have today and turns
                evaluation into a release discipline, not a one-off audit.
              </p>
            </div>
            <div className={styles.workflowGrid}>
              {workflow.map((item) => (
                <article key={item.step} className={styles.workflowCard}>
                  <div>
                    <span>{item.step} / {item.kicker.toUpperCase()}</span>
                    <strong>{item.step}</strong>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <small>{item.meta}</small>
                </article>
              ))}
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.evidenceSection}>
            <div className={styles.evidenceHeading}>
              <SectionLabel number="07">Beyond the score</SectionLabel>
              <h2>
                The number is the headline.
                <br />
                <em>The evidence is the product.</em>
              </h2>
            </div>
            <div className={styles.evidenceGrid}>
              {verdictLayers.map((layer) => (
                <article key={layer.label}>
                  <div>
                    <span>{layer.label.toUpperCase()}</span>
                    <strong>{layer.number}</strong>
                  </div>
                  <h3>{layer.title}</h3>
                  <p>{layer.body}</p>
                  {layer.number === "03" && (
                    <span className={styles.badgeDemo}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/api/badge/demo" alt="Preflight score badge: 97" />
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>
        </LandingReveal>

        <LandingReveal>
          <section className={styles.closingCta}>
            <div className={styles.closingGrid} aria-hidden />
            <div className={styles.eyebrow}>
              <span aria-hidden />
              Your agent has a blind spot
            </div>
            <h2>
              Find it before
              <br />
              <em>a customer does.</em>
            </h2>
            <p>
              Run the demo in under two minutes. No setup, no credit card, and
              every failure comes with a replay.
            </p>
            <div className={styles.closingActions}>
              <ButtonLink href="/runs" size="lg">
                Run the demo
              </ButtonLink>
              <ButtonLink href="/signup" size="lg" variant="secondary">
                Start free
              </ButtonLink>
            </div>
          </section>
        </LandingReveal>

        <footer className={styles.footer}>
          <Link href="/" className={styles.brand} aria-label="Preflight home">
            <span className={styles.brandSignal} aria-hidden />
            <span>PREFLIGHT</span>
          </Link>
          <p>TEST BEFORE TRUST · © 2026</p>
          <nav aria-label="Footer navigation">
            <Link href="/product">Product</Link>
            <Link href="/integrations">Integrations</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/signup" className={styles.footerCta}>
              Start free →
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
