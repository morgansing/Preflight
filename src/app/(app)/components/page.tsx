"use client";

import { ReadinessCard } from "@/components/readiness-card";
import { Sparkline } from "@/components/sparkline";
import {
  Button,
  Card,
  Eyebrow,
  OutcomeChip,
  Skeleton,
} from "@/components/ui";

/** Design-system proof page — build step 1's checkpoint. */

const swatches = [
  ["bg", "#0B0C0E"],
  ["surface", "#131519"],
  ["raised", "#1A1D23"],
  ["edge", "#242830"],
  ["ink", "#E8EAED"],
  ["sub", "#9BA1AC"],
  ["mut", "#5C626D"],
  ["accent", "#3DDC84"],
  ["fail", "#F0544F"],
  ["warn", "#E0A340"],
] as const;

export default function ComponentsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-8 py-10">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink">
          Design system
        </h1>
        <p className="mt-2 text-sm text-sub">
          Tokens, type and base components — everything else is built from
          these.
        </p>
      </div>

      <section>
        <Eyebrow>Type</Eyebrow>
        <div className="mt-6 space-y-4">
          <div className="font-display text-5xl tracking-tight text-ink">
            The flight simulator for AI agents.
          </div>
          <div className="numeral text-7xl text-ink">
            91<span className="text-3xl text-sub">%</span>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-sub">
            Body text is Inter at a comfortable measure. Secondary text carries
            most explanations; primary text is reserved for what matters.
          </p>
          <code className="block font-mono text-[13px] text-sub">
            issue_refund(&#123; order_id: &quot;A38423&quot;, amount: 218.40 &#125;)
          </code>
        </div>
      </section>

      <section>
        <Eyebrow>Palette</Eyebrow>
        <div className="mt-6 flex flex-wrap gap-3">
          {swatches.map(([name, hex]) => (
            <div key={name} className="w-24">
              <div
                className="h-14 rounded-lg border border-edge"
                style={{ background: hex }}
              />
              <div className="mt-1.5 font-mono text-[10px] text-mut">
                {name}
                <br />
                {hex}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow>Buttons</Eyebrow>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button>Run the demo</Button>
          <Button variant="secondary">Replay demo run</Button>
          <Button variant="ghost">Cancel</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section>
        <Eyebrow>Status language</Eyebrow>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <OutcomeChip outcome="pass" />
          <OutcomeChip outcome="fail" />
          <OutcomeChip outcome="partial" />
          <Sparkline values={[62, 68, 71, 74, 79, 78, 84, 88, 87, 91]} threshold={90} />
        </div>
      </section>

      <section>
        <Eyebrow>Surfaces & loading</Eyebrow>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <div className="text-sm font-medium text-ink">Card</div>
            <p className="mt-1.5 text-[13px] text-sub">
              Hairline border, 24px padding, soft shadow.
            </p>
          </Card>
          <Card>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <Skeleton className="mt-3 h-4 w-5/6" />
          </Card>
        </div>
      </section>

      <section className="max-w-md">
        <Eyebrow>The hero component</Eyebrow>
        <ReadinessCard
          className="mt-6"
          score={97}
          strengths={["Product questions", "Shipping updates", "Order status"]}
          weaknesses={["Refund fraud", "Duplicate orders", "Escalations"]}
          meta="Last run · 2m ago · 200 scenarios"
        />
      </section>
    </div>
  );
}
