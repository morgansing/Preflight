"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useLiveAgents, type ConnectionKind } from "@/lib/live";
import { useMode } from "@/lib/mode";
import styles from "../agents.module.css";

const options: { kind: ConnectionKind; title: string; body: string; badge?: string }[] = [
  {
    kind: "openai",
    title: "OpenAI-compatible endpoint",
    body: "Your agent speaks the chat-completions tool-calling dialect (OpenAI, Azure, vLLM, LangChain, CrewAI). Paste the URL, model and key; no code to write.",
    badge: "ZERO SHIM",
  },
  {
    kind: "http",
    title: "HTTP endpoint",
    body: "You own the agent loop. Preflight POSTs the conversation and tool schema; your endpoint returns the next action. Approximately a 20-line shim.",
  },
  {
    kind: "reference",
    title: "Built-in reference agent",
    body: "A deliberately imperfect support agent that ships with Preflight. Live runs work with nothing external connected.",
  },
  {
    kind: "mcp",
    title: "MCP endpoint",
    body: "Connect an agent that speaks the Model Context Protocol. Registration works; running MCP agents is the next milestone.",
  },
];

interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  request?: { url: string; method: string; headers: Record<string, string>; body: unknown };
  response?: { status: number; body: unknown };
  interpretation?: string;
  error?: string;
}

export default function ConnectAgentPage() {
  const router = useRouter();
  const { setMode } = useMode();
  const { register } = useLiveAgents();
  const [kind, setKind] = useState<ConnectionKind>("openai");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [authToken, setAuthToken] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);

  const needsEndpoint = kind === "http" || kind === "openai" || kind === "mcp";
  const canProbe = (kind === "http" || kind === "openai") && endpoint.trim().length > 0;
  const selectedOption = options.find((option) => option.kind === kind)!;

  const test = async () => {
    setProbing(true);
    setProbe(null);
    try {
      const res = await fetch("/api/live/test-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentKind: kind, endpoint, model, authToken, systemPrompt }),
      });
      setProbe(await res.json());
    } catch (err) {
      setProbe({ ok: false, latencyMs: 0, error: String(err) });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className={styles.journey}>
      <div className={styles.ambient} aria-hidden />
      <div className={`${styles.shell} ${styles.connectShell}`}>
        <header className={`${styles.hero} ${styles.connectHero}`}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrow}>
              <span /> Live mode / agent registration
            </div>
            <h1>
              Connect the agent. <em>Keep the evidence.</em>
            </h1>
            <p>
              Live mode runs your agent for real against a simulated store seeded with
              realistic mess, then scores every transcript against the scenario rubrics.
              Nothing here is scripted.
            </p>
          </div>
          <div className={styles.heroActions}>
            <div className={styles.workspaceStatus}>
              <span className={styles.workspaceDot} aria-hidden />
              <span>
                <strong>Local V0 registry</strong>
                Connection details saved in this browser
              </span>
            </div>
            <Link href="/integration" className={styles.textLink}>
              Integration guide →
            </Link>
          </div>
        </header>

        <div className={styles.connectionSteps} role="list" aria-label="Connection workflow">
          <div className={styles.connectionStep} role="listitem">
            <span>01</span>
            <div>
              <strong>Choose a transport</strong>
              <small>OpenAI-compatible / HTTP / reference / MCP</small>
            </div>
          </div>
          <div className={styles.connectionStep} role="listitem">
            <span>02</span>
            <div>
              <strong>Provide its connection</strong>
              <small>Endpoint, model and credentials when required</small>
            </div>
          </div>
          <div className={styles.connectionStep} role="listitem">
            <span>03</span>
            <div>
              <strong>Enter the live harness</strong>
              <small>Register, run scenarios and inspect the evidence</small>
            </div>
          </div>
        </div>

        <form
          className={styles.connectForm}
          onSubmit={(event) => {
            event.preventDefault();
            const agent = register({
              name: name || (kind === "reference" ? "Reference agent" : "Unnamed agent"),
              kind,
              endpoint: kind === "reference" ? undefined : endpoint,
              model: kind === "openai" ? model : undefined,
              authToken: authToken || undefined,
              systemPrompt: kind === "openai" ? systemPrompt || undefined : undefined,
            });
            setMode("live");
            // MCP registrations are saved for the upcoming transport support,
            // but the current harness cannot run them. Land on the saved-agent
            // inventory instead of silently falling back to the reference agent.
            if (agent.kind === "mcp") {
              router.push("/agents?connected=mcp");
              return;
            }
            router.push(`/runs?agent=${encodeURIComponent(agent.id)}`);
          }}
        >
          <fieldset className={styles.transportPanel}>
            <legend>
              <span className={styles.panelEyebrow}>01 / Transport</span>
              <strong>How does this agent answer?</strong>
            </legend>
            <p className={styles.transportIntro}>
              Select the contract Preflight should use. Each option keeps its existing
              registration and run behavior.
            </p>
            <div className={styles.transportOptions}>
              {options.map((option) => (
                <label
                  key={option.kind}
                  className={styles.transportOption}
                  data-selected={kind === option.kind}
                >
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === option.kind}
                    onChange={() => {
                      setKind(option.kind);
                      setProbe(null);
                    }}
                  />
                  <span>
                    <span className={styles.transportTitle}>
                      {option.title}
                      {option.badge && (
                        <span className={styles.transportBadge}>{option.badge}</span>
                      )}
                    </span>
                    <span className={styles.transportDescription}>{option.body}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className={styles.configurationPanel} aria-labelledby="configuration-title">
            <div className={styles.configurationHeader}>
              <div>
                <div className={styles.panelEyebrow}>02 / Configuration</div>
                <h2 id="configuration-title">Connection details</h2>
                <p>Only fields required by the selected transport are shown.</p>
              </div>
              <span className={styles.selectedTransport}>{selectedOption.title}</span>
            </div>

            <div className={styles.configurationBody}>
              <div className={styles.fieldGrid}>
                <label className={needsEndpoint ? styles.field : styles.fieldWide}>
                  <span className={styles.microLabel}>Agent name</span>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={kind === "reference" ? "Reference agent" : "Aurora Support v1.4"}
                  />
                </label>

                {needsEndpoint && (
                  <label className={styles.field}>
                    <span className={styles.microLabel}>
                      {kind === "mcp"
                        ? "MCP server URL"
                        : kind === "openai"
                          ? "Base or chat-completions URL"
                          : "Endpoint URL"}
                    </span>
                    <input
                      className={styles.input}
                      type="url"
                      required
                      value={endpoint}
                      onChange={(event) => {
                        setEndpoint(event.target.value);
                        setProbe(null);
                      }}
                      placeholder={
                        kind === "openai"
                          ? "https://api.example.com/v1"
                          : kind === "mcp"
                            ? "https://mcp.example.com/sse"
                            : "https://agents.example.com/preflight"
                      }
                    />
                  </label>
                )}

                {kind === "openai" && (
                  <>
                    <label className={styles.field}>
                      <span className={styles.microLabel}>Model</span>
                      <input
                        className={styles.input}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder="gpt-4o"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.microLabel}>API key</span>
                      <input
                        className={styles.input}
                        type="password"
                        value={authToken}
                        onChange={(event) => setAuthToken(event.target.value)}
                        placeholder="sk-…"
                      />
                      <span className={styles.fieldHint}>
                        Sent as <code>Authorization: Bearer …</code> on every request.
                      </span>
                    </label>
                    <label className={styles.fieldWide}>
                      <span className={styles.microLabel}>System prompt / optional</span>
                      <textarea
                        className={`${styles.input} ${styles.textarea}`}
                        value={systemPrompt}
                        onChange={(event) => setSystemPrompt(event.target.value)}
                        placeholder="Only needed if this endpoint is a bare model API. Model providers do not expose your prompt, so paste it here to test your agent rather than a blank model."
                      />
                      <span className={styles.fieldHint}>
                        If the endpoint is your own agent service, its prompt is already inside it.
                        Leave this blank.
                      </span>
                    </label>
                  </>
                )}

                {kind === "http" && (
                  <label className={styles.fieldWide}>
                    <span className={styles.microLabel}>Bearer token / optional</span>
                    <input
                      className={styles.input}
                      type="password"
                      value={authToken}
                      onChange={(event) => setAuthToken(event.target.value)}
                      placeholder="Sent as Authorization: Bearer …"
                    />
                    <span className={styles.fieldHint}>
                      Sent as <code>Authorization: Bearer …</code> on every request to your endpoint.
                    </span>
                  </label>
                )}

                {(kind === "http" || kind === "openai") && (
                  <p className={styles.referenceNote}>
                    V0 stores the token in this browser. Production moves it to server-side secrets.
                  </p>
                )}

                {kind === "reference" && (
                  <p className={styles.referenceNote}>
                    No endpoint or provider credential is needed. This deliberately imperfect
                    built-in agent can enter the current live harness immediately.
                  </p>
                )}

                {kind === "mcp" && (
                  <p className={styles.mcpNote}>
                    This connection can be saved to the inventory. MCP execution is not available
                    in the current harness yet.
                  </p>
                )}
              </div>
            </div>

            {(kind === "http" || kind === "openai") && (
              <div className={styles.probePanel}>
                <div className={styles.probeHeader}>
                  <div>
                    <h3>Test the connection</h3>
                    <p>Fires one canned step at your endpoint. No run, no store changes.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={test}
                    disabled={!canProbe || probing}
                  >
                    {probing ? "Testing…" : "Test connection"}
                  </Button>
                </div>

                {probe && (
                  <div
                    className={styles.probeResult}
                    data-ok={probe.ok}
                    role="status"
                    aria-live="polite"
                  >
                    <div className={styles.probeStatus}>
                      {probe.ok ? "✓ Connected" : "✕ Not connected"}
                      {probe.latencyMs ? <span>{probe.latencyMs}ms</span> : null}
                    </div>
                    <p>{probe.interpretation ?? probe.error}</p>
                    {probe.request && (
                      <details>
                        <summary>RAW REQUEST → {probe.request.url}</summary>
                        <pre className={styles.rawPayload}>
                          {JSON.stringify(probe.request.body, null, 2)}
                        </pre>
                      </details>
                    )}
                    {probe.response && (
                      <details>
                        <summary>RAW RESPONSE / HTTP {probe.response.status}</summary>
                        <pre className={styles.rawPayload}>
                          {JSON.stringify(probe.response.body, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={styles.submitBar}>
              <p className={styles.submitNote}>
                {kind === "mcp" ? (
                  <>
                    This saves the MCP connection to your agent inventory. MCP execution is not
                    available in the current harness yet.
                  </>
                ) : (
                  <>
                    Live runs also need Preflight&apos;s own judge/persona model (never your agent).
                    Set <code>PREFLIGHT_LLM_KEY</code> on the server.
                  </>
                )}
              </p>
              <Button type="submit">
                {kind === "mcp" ? "Save MCP registration" : "Register agent"}
              </Button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
