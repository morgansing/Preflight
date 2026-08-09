import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
  MarketingMain,
} from "@/components/marketing-shell";
import styles from "./integrations.module.css";

const connectionTiles = [
  {
    mark: "OA",
    name: "OpenAI-compatible",
    type: "Native wire contract",
    copy: "Any chat/completions endpoint with tool calling.",
  },
  {
    mark: "AZ",
    name: "Azure OpenAI",
    type: "OpenAI-compatible",
    copy: "Use the deployment endpoint and model identifier.",
  },
  {
    mark: "VL",
    name: "vLLM / TGI",
    type: "Self-hosted",
    copy: "Connect the compatible API exposed by your inference server.",
  },
  {
    mark: "LC",
    name: "LangChain",
    type: "Framework backend",
    copy: "Expose the agent behind either supported endpoint contract.",
  },
  {
    mark: "CR",
    name: "CrewAI",
    type: "Framework backend",
    copy: "Wrap the crew's next action behind a small HTTP endpoint.",
  },
  {
    mark: "AI",
    name: "Vercel AI SDK",
    type: "Framework backend",
    copy: "Use an OpenAI-compatible route or the custom HTTP contract.",
  },
  {
    mark: "HTTP",
    name: "Your agent",
    type: "Custom HTTP",
    copy: "Keep your control loop; return one tool call or reply at a time.",
  },
];

export default function IntegrationsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden>
        <div className={styles.grid} />
      </div>

      <MarketingHeader active="integrations" />

      <MarketingMain className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span aria-hidden />
              Bring the agent you already have
            </div>
            <h1>
              One endpoint between
              <br />
              <em>your agent and the storm.</em>
            </h1>
            <p>
              Connect an OpenAI-compatible API with no shim, or keep your own
              agent loop behind a small HTTP contract. Preflight supplies the
              simulated customer, store tools, and independent judge.
            </p>
            <div className={styles.heroActions}>
              <Link href="/agents/connect" className={styles.primaryButton}>
                Connect an agent <span aria-hidden>→</span>
              </Link>
              <Link href="/share/demo" className={styles.secondaryButton}>
                Open verified demo
              </Link>
            </div>
            <p className={styles.reachability}>
              Your endpoint must be reachable from the Preflight server via a
              public URL or a secure tunnel.
            </p>
          </div>

          <div className={styles.network} aria-label="Agent connection architecture">
            <div className={styles.networkTopbar}>
              <span>CONNECTION TEST · AGENT-07</span>
              <span>
                <i aria-hidden />
                HEALTHY
              </span>
            </div>
            <div className={styles.networkCanvas}>
              <div className={`${styles.node} ${styles.agentNode}`}>
                <small>YOUR INFRASTRUCTURE</small>
                <strong>AGENT ENDPOINT</strong>
                <span>https://agent.yourco.com/v1</span>
              </div>
              <div className={styles.packetRail} aria-hidden>
                <i />
                <span>HTTPS</span>
              </div>
              <div className={`${styles.node} ${styles.preflightNode}`}>
                <small>PREFLIGHT</small>
                <strong>EVALUATION LOOP</strong>
                <span>persona · tools · judge</span>
              </div>
              <div className={styles.toolFan} aria-hidden>
                <span>get_order</span>
                <span>issue_refund</span>
                <span>escalate</span>
              </div>
            </div>
            <div className={styles.networkLog}>
              <div>
                <span>01</span>
                Endpoint reachable
                <strong>42ms</strong>
              </div>
              <div>
                <span>02</span>
                Tool schema accepted
                <strong>9 tools</strong>
              </div>
              <div>
                <span>03</span>
                Tool call returned
                <strong className={styles.live}>ready</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.compatibility}>
          <div className={styles.sectionIntro}>
            <div className={styles.sectionLabel}>01 / Connection surface</div>
            <h2>
              Framework-agnostic
              <br />
              <em>by design.</em>
            </h2>
            <p>
              Preflight connects to network contracts, not to a particular
              orchestration stack. If your framework can expose one of the two
              supported endpoints, the agent can be evaluated without moving
              its prompts, tools, or control flow into Preflight.
            </p>
          </div>

          <div className={styles.tileGrid}>
            {connectionTiles.map((tile, index) => (
              <article
                className={index === 0 || index === 6 ? styles.featuredTile : ""}
                key={tile.name}
              >
                <div className={styles.tileTop}>
                  <span className={styles.tileMark}>{tile.mark}</span>
                  <span className={styles.tileStatus}>
                    <i aria-hidden />
                    SUPPORTED
                  </span>
                </div>
                <h3>{tile.name}</h3>
                <small>{tile.type}</small>
                <p>{tile.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.paths}>
          <div className={styles.pathsHeading}>
            <div className={styles.sectionLabel}>02 / Two ways in</div>
            <h2>
              Use the wire contract
              <br />
              <em>you already speak.</em>
            </h2>
          </div>

          <div className={styles.pathGrid}>
            <article className={styles.pathCard}>
              <div className={styles.pathTop}>
                <span>PATH 01</span>
                <strong>ZERO SHIM</strong>
              </div>
              <h3>OpenAI-compatible chat/completions</h3>
              <p>
                Give Preflight the base URL, model, authorization token when
                required, and the system prompt that defines the agent.
                Preflight sends messages and tool schemas, executes returned
                tool calls against the simulated store, and continues until the
                agent replies.
              </p>
              <div className={styles.requestDiagram}>
                <div>
                  <small>POST</small>
                  <code>/v1/chat/completions</code>
                </div>
                <ul>
                  <li>
                    <span>messages</span>
                    <strong>conversation + tool results</strong>
                  </li>
                  <li>
                    <span>tools</span>
                    <strong>9 simulated-store schemas</strong>
                  </li>
                  <li>
                    <span>response</span>
                    <strong>tool_calls or assistant reply</strong>
                  </li>
                </ul>
                <div className={styles.requestPulse} aria-hidden />
              </div>
              <div className={styles.worksWith}>
                <span>WORKS WITH</span>
                <p>OpenAI · Azure OpenAI · vLLM · TGI · compatible gateways</p>
              </div>
            </article>

            <article className={styles.pathCard}>
              <div className={styles.pathTop}>
                <span>PATH 02</span>
                <strong>SMALL ADAPTER</strong>
              </div>
              <h3>Custom HTTP agent contract</h3>
              <p>
                Keep the agent&apos;s control flow exactly where it lives. On
                every turn, Preflight POSTs the conversation, actions so far,
                and tool schemas. Your endpoint returns one next action: call a
                tool or reply to the customer.
              </p>
              <div className={styles.contractDiagram}>
                <div className={styles.contractInput}>
                  <span>PREFLIGHT SENDS</span>
                  <code>
                    conversation
                    <br />
                    actions_so_far
                    <br />
                    tools
                  </code>
                </div>
                <div className={styles.contractArrow} aria-hidden>
                  →
                </div>
                <div className={styles.contractOutput}>
                  <span>YOU RETURN</span>
                  <code>
                    tool_call
                    <br />
                    or reply
                  </code>
                </div>
              </div>
              <div className={styles.worksWith}>
                <span>USE THIS FOR</span>
                <p>LangChain · CrewAI · Vercel AI SDK · proprietary loops</p>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.requirements}>
          <div className={styles.requirementsCopy}>
            <div className={styles.sectionLabel}>03 / Required inputs</div>
            <h2>
              Four fields.
              <br />
              <em>One honest test.</em>
            </h2>
            <p>
              Preflight needs enough information to call the agent under test
              as a real client would. The connection test verifies reachability
              and confirms the tool loop before a simulation spends any credit.
            </p>
            <Link href="/agents/connect" className={styles.textLink}>
              Open the connection form <span aria-hidden>→</span>
            </Link>
          </div>

          <div className={styles.inputPanel}>
            <div className={styles.inputHeader}>
              <span>AGENT CONNECTION</span>
              <span>DRAFT</span>
            </div>
            {[
              ["ENDPOINT", "https://agent.yourco.com/v1", "Required"],
              ["MODEL", "your-model-or-deployment", "OpenAI path"],
              ["AUTHORIZATION", "Bearer ••••••••••••", "When required"],
              ["SYSTEM PROMPT", "The instructions your agent uses", "OpenAI path"],
            ].map(([label, value, note], index) => (
              <div className={styles.field} key={label}>
                <label>{label}</label>
                <span>{value}</span>
                <small>{note}</small>
                <i style={{ "--field-delay": `${index * 0.6}s` } as React.CSSProperties} aria-hidden />
              </div>
            ))}
            <div className={styles.testRow}>
              <span>
                <i aria-hidden />
                Connection test ready
              </span>
              <strong>TEST CONNECTION →</strong>
            </div>
          </div>
        </section>

        <section className={styles.boundaries}>
          <div className={styles.boundariesHeading}>
            <div className={styles.sectionLabel}>04 / Data boundaries</div>
            <h2>
              The simulation crosses the wire.
              <br />
              <em>Your production system does not move.</em>
            </h2>
            <p>
              Preflight evaluates the agent remotely. It does not require your
              production customer database or take ownership of the model,
              orchestration code, prompts, or infrastructure.
            </p>
          </div>

          <div className={styles.boundaryMap}>
            <div className={styles.yourBoundary}>
              <div className={styles.boundaryTitle}>
                <span>YOUR BOUNDARY</span>
                <small>YOUR INFRASTRUCTURE</small>
              </div>
              <div className={styles.boundaryItems}>
                {[
                  ["Agent code", "Your orchestration and decision logic"],
                  ["Model provider", "Your account, deployment, and model bill"],
                  ["System prompt", "Sent for the evaluation configuration"],
                  ["Endpoint auth", "Bearer token used on outbound requests"],
                ].map(([title, copy]) => (
                  <div key={title}>
                    <span>✓</span>
                    <p>
                      <strong>{title}</strong>
                      <small>{copy}</small>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.boundaryTransit}>
              <span>HTTPS</span>
              <div aria-hidden>
                <i />
              </div>
              <small>
                Evaluation messages
                <br />
                Tool schemas + results
                <br />
                Agent actions + replies
              </small>
            </div>

            <div className={styles.preflightBoundary}>
              <div className={styles.boundaryTitle}>
                <span>PREFLIGHT BOUNDARY</span>
                <small>EVALUATION ENVIRONMENT</small>
              </div>
              <div className={styles.boundaryItems}>
                {[
                  ["Simulated customer", "Improvises from the scenario setup"],
                  ["Seeded store", "Run-scoped records and tool mutations"],
                  ["Independent judge", "Grades the transcript against its rubric"],
                  ["Evidence", "Replay, verdict, cluster, and report output"],
                ].map(([title, copy]) => (
                  <div key={title}>
                    <span>✓</span>
                    <p>
                      <strong>{title}</strong>
                      <small>{copy}</small>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.boundaryNotes}>
            <article>
              <span>NO PRODUCTION STORE REQUIRED</span>
              <p>
                Evaluations use Preflight&apos;s seeded store. Tool calls and
                mutations are scoped to the run, so a bad refund decision can
                fail safely without touching a real order.
              </p>
            </article>
            <article>
              <span>THE JUDGE IS SEPARATE</span>
              <p>
                The endpoint under test never grades itself. Preflight owns the
                simulated customer and scoring judge; your endpoint is only the
                agent being evaluated.
              </p>
            </article>
            <article>
              <span>REACHABILITY IS EXPLICIT</span>
              <p>
                A private local endpoint needs a tunnel such as ngrok or
                Cloudflare Tunnel. Use a dedicated evaluation endpoint and
                scoped credentials for the connection.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.wireSection}>
          <div className={styles.wirePanel}>
            <div className={styles.wireTopbar}>
              <span>ONE TURN · CUSTOM HTTP</span>
              <span>APPLICATION / JSON</span>
            </div>
            <div className={styles.codeFlow}>
              <div>
                <span>REQUEST</span>
                <pre>
                  <code>{`{
  "conversation": [
    { "role": "customer",
      "text": "Where is order A38423?" }
  ],
  "actions_so_far": [],
  "tools": [ /* schemas */ ]
}`}</code>
                </pre>
              </div>
              <div className={styles.codeArrow} aria-hidden>
                <i />
                <span>NEXT ACTION</span>
              </div>
              <div>
                <span>RESPONSE</span>
                <pre>
                  <code>{`{
  "action": "tool_call",
  "tool": "get_order",
  "input": {
    "order_id": "A38423"
  }
}`}</code>
                </pre>
              </div>
            </div>
          </div>
          <div className={styles.wireCopy}>
            <div className={styles.sectionLabel}>05 / The whole contract</div>
            <h2>
              One next action
              <br />
              <em>at a time.</em>
            </h2>
            <p>
              Preflight executes the requested store tool, appends its result,
              and calls the endpoint again. The turn ends when the agent returns
              a reply. That narrow contract makes proprietary loops testable
              without rebuilding them inside another platform.
            </p>
          </div>
        </section>

        <section className={styles.closing}>
          <div className={styles.closingGrid} aria-hidden />
          <div className={styles.eyebrow}>
            <span aria-hidden />
            Connect, verify, simulate
          </div>
          <h2>
            Keep your stack.
            <br />
            <em>Add the pressure test.</em>
          </h2>
          <p>
            Point Preflight at an evaluation endpoint and verify the tool loop
            before the first run. Your first 250 simulations are free.
          </p>
          <div className={styles.heroActions}>
            <Link href="/agents/connect" className={styles.primaryButton}>
              Connect an agent <span aria-hidden>→</span>
            </Link>
            <Link href="/pricing" className={styles.secondaryButton}>
              View pricing
            </Link>
          </div>
        </section>

      </MarketingMain>

      <MarketingFooter />
    </div>
  );
}
