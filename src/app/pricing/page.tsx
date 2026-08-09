import Link from "next/link";
import type { ReactNode } from "react";
import {
  MarketingFooter,
  MarketingHeader,
  MarketingMain,
} from "@/components/marketing-shell";
import {
  DEFAULT_CATALOG,
  parseCatalog,
  type BillingCatalog,
  type CatalogPlan,
} from "@/lib/billing-catalog";
import { tierById } from "@/lib/suite-tiers";
import styles from "./pricing.module.css";

const standardRun = tierById("standard");

if (!standardRun) {
  throw new Error("The Standard suite tier is required to render pricing.");
}

const STANDARD_RUN = standardRun;

function getPricingCatalog(): BillingCatalog {
  const override = process.env.BILLING_CATALOG_JSON;
  if (!override) return DEFAULT_CATALOG;

  try {
    return parseCatalog(override);
  } catch {
    return DEFAULT_CATALOG;
  }
}

function money(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function standardRunEquivalent(plan: CatalogPlan) {
  const runs = plan.monthlyTokens / STANDARD_RUN.size;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: runs < 10 ? 2 : 0,
  }).format(runs);
}

function maxSuiteLabel(plan: CatalogPlan) {
  const tier = tierById(plan.limits.maxSuite);
  return tier
    ? `${tier.name} · ${tier.size.toLocaleString()} scenarios`
    : plan.limits.maxSuite;
}

function allowanceLabel(plan: CatalogPlan) {
  const amount = plan.monthlyTokens.toLocaleString();
  return plan.period === "monthly" ? `${amount} / month` : `${amount} total`;
}

function planPriceLabel(plan: CatalogPlan) {
  return plan.priceMonthly === null ? money(0) : money(plan.priceMonthly);
}

function effectiveStandardRunPrice(plan: CatalogPlan) {
  if (plan.priceMonthly === null) return null;
  const runEquivalent = plan.monthlyTokens / STANDARD_RUN.size;
  return money(plan.priceMonthly / runEquivalent, 2);
}

function FeatureCheck({ children }: { children: ReactNode }) {
  return (
    <li className={styles.feature}>
      <span className={styles.check} aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function PricingPage() {
  const catalog = getPricingCatalog();
  const plans = catalog.plans;
  const freePlan = plans.find((plan) => plan.priceMonthly === null) ?? plans[0];
  const monthlyPlans = plans.filter((plan) => plan.period === "monthly");
  const allowancesRollover = monthlyPlans.some((plan) => plan.rollover);

  const faq: Array<{ question: string; answer: ReactNode }> = [
    {
      question: "What exactly counts as one simulation?",
      answer: (
        <>
          One scenario, executed once against your agent. That can include a full
          multi-turn customer conversation, tool calls, store state, and a
          rubric-based verdict. A {STANDARD_RUN.name} run contains{" "}
          {STANDARD_RUN.size.toLocaleString()} scenarios, so it consumes{" "}
          {STANDARD_RUN.size.toLocaleString()} simulations. Rerunning it after a
          fix consumes the same amount again.
        </>
      ),
    },
    {
      question: "Is this monthly or annual pricing?",
      answer: (
        <>
          Paid plans are billed monthly. The prices above do not assume an
          annual contract or hide an annual commitment. The free allowance is a
          one-time grant, not a monthly refill.
        </>
      ),
    },
    {
      question: "Do unused simulations roll over?",
      answer: allowancesRollover ? (
        <>
          Rollover depends on the plan; the comparison table shows the current
          rule for each one. Purchased credit-pack simulations never expire.
        </>
      ) : (
        <>
          Monthly plan allowances reset at the end of each billing cycle and do
          not roll over. Purchased credit-pack simulations are different: they
          never expire and are used after the monthly allowance.
        </>
      ),
    },
    {
      question: "Does the price include my agent's model bill?",
      answer: (
        <>
          No. Your agent runs on your infrastructure and with your provider
          keys, so its model and tool costs remain on your bill. Preflight does
          not mark them up. Your simulation balance covers Preflight&apos;s
          customer simulation, store, judge, replays, reports, baselines, and
          CI gate.
        </>
      ),
    },
    {
      question: "What happens if a run needs more simulations than I have?",
      answer: (
        <>
          Preflight checks the required balance before launch. Add a
          non-expiring credit pack or enable automatic overage on a paid plan,
          then start the run. A wall that has already launched is not stopped
          halfway through to ask for payment.
        </>
      ),
    },
    {
      question: "How are Gauntlet and Rulebook suites billed?",
      answer: (
        <>
          They use the same meter as every other suite: one executed scenario is
          one simulation. There is no separate Gauntlet add-on fee. The
          simulation count is shown before launch, so you know the balance a run
          will use.
        </>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden>
        <div className={styles.grid} />
        <div className={styles.flareOne} />
        <div className={styles.flareTwo} />
      </div>

      <MarketingHeader active="pricing" />

      <MarketingMain className={styles.main}>
        <section
          className={styles.pricingIntro}
          aria-labelledby="pricing-heading"
        >
          <div className={styles.introLead}>
            <p className={styles.sectionEyebrow}>
              Pricing / monthly simulation billing
            </p>
            <h1 id="pricing-heading">
              Monthly simulation allowances, plainly priced.
            </h1>
          </div>

          <div className={styles.introSummaryBlock}>
            <p className={styles.introSummary}>
              Choose how many evaluated scenarios your release cadence needs.
              Allowance, launch depth, concurrency, and overage are explicit
              before a run begins.
            </p>
            <div className={`${styles.actionRow} ${styles.introActions}`}>
              <Link href="/signup" className={styles.primaryButton}>
                Start free <span aria-hidden>→</span>
              </Link>
              <Link href="/share/demo" className={styles.secondaryButton}>
                Open verified demo
              </Link>
            </div>
          </div>

          <div
            className={styles.introLedger}
            aria-label="Preflight pricing summary"
          >
            <div>
              <span>Billing unit</span>
              <strong>1 complete scenario + verdict</strong>
            </div>
            <div>
              <span>{STANDARD_RUN.name} run</span>
              <strong>
                {STANDARD_RUN.size.toLocaleString()} simulations
              </strong>
            </div>
            <div>
              <span>Free allowance</span>
              <strong>
                {freePlan.monthlyTokens.toLocaleString()} one-time · no card
              </strong>
            </div>
            <div>
              <span>Paid billing</span>
              <strong>Monthly · no per-seat charge</strong>
            </div>
          </div>
        </section>

        <section
          className={styles.unitSection}
          aria-labelledby="simulation-unit-heading"
        >
          <div className={styles.unitVisual}>
            <div className={styles.visualTopline}>
              <span>SIMULATION / ACTIVE</span>
              <span className={styles.liveState}>
                <i aria-hidden />
                Evaluating
              </span>
            </div>
            <div className={styles.flow}>
              <div className={styles.flowNode}>
                <span>01</span>
                <strong>Customer</strong>
                <small>Realistic intent</small>
              </div>
              <div className={styles.flowRail} aria-hidden>
                <span />
              </div>
              <div className={styles.flowNode}>
                <span>02</span>
                <strong>Your agent</strong>
                <small>Replies + tools</small>
              </div>
              <div className={styles.flowRail} aria-hidden>
                <span />
              </div>
              <div className={styles.flowNode}>
                <span>03</span>
                <strong>Judge</strong>
                <small>Evidence + verdict</small>
              </div>
            </div>
            <div className={styles.verdict}>
              <div>
                <span className={styles.verdictDot} aria-hidden />
                <strong>PASS</strong>
              </div>
              <span>Replay stored · rubric checked · report updated</span>
            </div>
          </div>

          <div className={styles.unitCopy}>
            <p className={styles.sectionEyebrow}>The billing unit</p>
            <h2 id="simulation-unit-heading">
              One scenario. One verdict. One simulation.
            </h2>
            <p>
              A simulation is not a message or a token. It is the complete test:
              the scenario setup, the conversation, tool activity, and the
              judged outcome. That makes usage predictable before a run begins.
            </p>
            <div className={styles.formula}>
              <span>
                1 {STANDARD_RUN.name} suite
                <small>Full base coverage</small>
              </span>
              <b aria-hidden>=</b>
              <strong>
                {STANDARD_RUN.size.toLocaleString()}
                <small>simulations</small>
              </strong>
            </div>
          </div>
        </section>

        <section
          id="plans"
          className={styles.plansSection}
          aria-labelledby="plans-heading"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Choose your testing cadence</p>
              <h2 id="plans-heading">From first failure to nightly sign-off.</h2>
            </div>
            <p>
              Every paid price is monthly. Standard-run equivalents translate
              the allowance into the way your team actually tests.
            </p>
          </div>

          <div className={styles.planGrid}>
            {plans.map((plan) => {
              const featured = plan.id === "team";
              const standardPrice = effectiveStandardRunPrice(plan);

              return (
                <article
                  key={plan.id}
                  className={`${styles.planCard} ${
                    featured ? styles.featuredPlan : ""
                  }`}
                >
                  {featured && (
                    <div className={styles.featuredLabel}>
                      <span aria-hidden />
                      Best for production teams
                    </div>
                  )}
                  <div className={styles.planTop}>
                    <div>
                      <p className={styles.planName}>{plan.name}</p>
                      <p className={styles.planTagline}>{plan.tagline}</p>
                    </div>
                    <span className={styles.planCode}>
                      {plan.period === "monthly" ? "MONTHLY" : "ONE-TIME"}
                    </span>
                  </div>

                  <div className={styles.price}>
                    <strong>{planPriceLabel(plan)}</strong>
                    <span>
                      {plan.priceMonthly === null
                        ? "one-time grant"
                        : "per month"}
                    </span>
                  </div>

                  <div className={styles.allowance}>
                    <div>
                      <span>Included</span>
                      <strong>{allowanceLabel(plan)}</strong>
                    </div>
                    <div>
                      <span>Equivalent</span>
                      <strong>
                        {standardRunEquivalent(plan)} Standard runs
                        {plan.period === "monthly" ? " / mo" : ""}
                      </strong>
                    </div>
                  </div>

                  {standardPrice ? (
                    <p className={styles.valueLine}>
                      {standardPrice} per Standard run at full allowance
                    </p>
                  ) : (
                    <p className={styles.valueLine}>
                      Enough to run the full Standard suite before paying
                    </p>
                  )}

                  <ul className={styles.features}>
                    {plan.features.map((feature) => (
                      <FeatureCheck key={feature}>{feature}</FeatureCheck>
                    ))}
                    <FeatureCheck>
                      Up to {plan.limits.concurrency} concurrent scenarios
                    </FeatureCheck>
                    <FeatureCheck>
                      Launch suites through {maxSuiteLabel(plan)}
                    </FeatureCheck>
                  </ul>

                  <Link
                    href="/signup"
                    className={
                      featured
                        ? styles.planButtonPrimary
                        : styles.planButtonSecondary
                    }
                    aria-label={
                      plan.priceMonthly === null
                        ? `Start with ${plan.name}`
                        : `Choose the ${plan.name} monthly plan`
                    }
                  >
                    {plan.priceMonthly === null
                      ? "Start testing free"
                      : `Choose ${plan.name}`}
                    <span aria-hidden>→</span>
                  </Link>
                </article>
              );
            })}
          </div>
          <p className={styles.planFootnote}>
            “Standard run” is a value comparison based on the{" "}
            {STANDARD_RUN.size.toLocaleString()}-scenario Standard suite.
            Effective per-run figures assume the full monthly allowance is
            used. Your actual agent-provider bill is separate.
          </p>
        </section>

        <section
          className={styles.comparisonSection}
          aria-labelledby="comparison-heading"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionEyebrow}>Side by side</p>
              <h2 id="comparison-heading">The limits, without the asterisks.</h2>
            </div>
            <p>
              Usage, launch depth, concurrency, and overage come directly from
              the same catalog Preflight enforces.
            </p>
          </div>

          <div className={styles.tableStage}>
            <p className={styles.tableHint} aria-hidden>
              Swipe to compare <span>→</span>
            </p>
            <div
              className={styles.tableWrap}
              role="region"
              aria-label="Scrollable pricing plan comparison"
              tabIndex={0}
            >
              <table className={styles.comparisonTable}>
              <caption className={styles.srOnly}>
                Comparison of Preflight pricing plans and enforced limits
              </caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  {plans.map((plan) => (
                    <th key={plan.id} scope="col">
                      <span>{plan.name}</span>
                      <small>
                        {plan.priceMonthly === null
                          ? money(0)
                          : `${money(plan.priceMonthly)} / mo`}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Included simulations</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>{allowanceLabel(plan)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Standard-run equivalent</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {standardRunEquivalent(plan)}
                      {plan.period === "monthly" ? " / month" : " total"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Largest launchable suite</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>{maxSuiteLabel(plan)}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Run concurrency</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {plan.limits.concurrency} scenarios at once
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Allowance rollover</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {plan.period === "lifetime"
                        ? "One-time grant"
                        : plan.rollover
                          ? "Rolls over"
                          : "Resets monthly"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Automatic overage</th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      {plan.overagePer1k === null
                        ? "Not available"
                        : `${money(plan.overagePer1k)} / extra 1,000`}
                    </td>
                  ))}
                </tr>
              </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={styles.costSection} aria-labelledby="cost-heading">
          <div className={styles.modelCallout}>
            <div className={styles.calloutSignal} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className={styles.sectionEyebrow}>Two bills, kept honest</p>
            <h2 id="cost-heading">Your model bill stays yours.</h2>
            <p>
              Preflight does not resell or mark up the model calls made by your
              agent. Keep your existing provider, keys, and infrastructure. We
              meter the evaluation layer around it.
            </p>
            <div className={styles.costSplit}>
              <div>
                <span>Preflight covers</span>
                <strong>
                  Persona · simulated store · judge · replays · reports · CI
                </strong>
              </div>
              <div>
                <span>You keep paying</span>
                <strong>Your agent&apos;s model calls and external tools</strong>
              </div>
            </div>
          </div>

          <div className={styles.creditPanel}>
            <p className={styles.sectionEyebrow}>Burst capacity</p>
            <h3>Credit packs that wait for you.</h3>
            <p>
              Buy once, use whenever. Pack simulations never expire and are
              drawn only after the current plan allowance is exhausted.
            </p>
            <div className={styles.packList}>
              {catalog.packs.map((pack) => {
                const perThousand = (pack.price / pack.tokens) * 1_000;
                return (
                  <div className={styles.pack} key={pack.id}>
                    <div>
                      <strong>{pack.tokens.toLocaleString()}</strong>
                      <span>simulations</span>
                    </div>
                    <div>
                      <strong>{money(pack.price)}</strong>
                      <span>{money(perThousand, 2)} / 1,000</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className={styles.packNote}>
              Prefer hands-off usage? Paid plans can opt into automatic overage
              at the plan-specific rate shown above. It is off by default.
            </p>
          </div>
        </section>

        <section className={styles.workflowSection} aria-labelledby="habit-heading">
          <div>
            <p className={styles.sectionEyebrow}>Why a monthly allowance?</p>
            <h2 id="habit-heading">Test every change. Keep the evidence.</h2>
          </div>
          <div className={styles.workflow} aria-label="Preflight testing workflow">
            {["Build", "Test", "Replay", "Fix", "Rerun", "Ship"].map(
              (step, index, all) => (
                <div className={styles.workflowStep} key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                  {index < all.length - 1 && <i aria-hidden>→</i>}
                </div>
              ),
            )}
          </div>
          <p>
            Readiness is a loop, not a launch-day audit. Plans are sized for the
            second run as much as the first: catch the failure, inspect the
            replay, change the agent, and rerun the same evidence before it
            reaches production.
          </p>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-heading">
          <div className={styles.faqIntro}>
            <p className={styles.sectionEyebrow}>Pricing FAQ</p>
            <h2 id="faq-heading">The fine print, in plain English.</h2>
            <p>
              Still working out your expected run volume? Start free and watch
              the usage meter on a real suite.
            </p>
            <Link href="/signup">
              Start with {freePlan.monthlyTokens.toLocaleString()} simulations{" "}
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className={styles.faqList}>
            {faq.map((item, index) => (
              <details key={item.question} className={styles.faqItem}>
                <summary>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.question}</strong>
                  <i aria-hidden>+</i>
                </summary>
                <div>{item.answer}</div>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-heading">
          <div className={styles.ctaGrid} aria-hidden />
          <div className={styles.ctaGlow} aria-hidden />
          <p className={styles.sectionEyebrow}>Your agent is already changing</p>
          <h2 id="final-cta-heading">Make the next release prove itself.</h2>
          <p>
            Connect an agent, generate its first suite, and get the evidence
            before you spend a dollar.
          </p>
          <div className={styles.actionRow}>
            <Link href="/signup" className={styles.primaryButton}>
              Start free <span aria-hidden>→</span>
            </Link>
            <Link href="/runs" className={styles.secondaryButton}>
              Explore the demo
            </Link>
          </div>
          <small>
            {freePlan.monthlyTokens.toLocaleString()} simulations · one-time
            free grant · no credit card
          </small>
        </section>
      </MarketingMain>

      <MarketingFooter />
    </div>
  );
}
