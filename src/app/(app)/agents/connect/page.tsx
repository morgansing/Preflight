"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useLiveAgents, type ConnectionKind } from "@/lib/live";
import { useMode } from "@/lib/mode";

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

const options: { kind: ConnectionKind; title: string; body: string; badge?: string }[] = [
  {
    kind: "openai",
    title: "OpenAI-compatible endpoint",
    body: "Your agent speaks the chat-completions tool-calling dialect (OpenAI, Azure, vLLM, LangChain, CrewAI…). Paste the URL, model and key — no code to write.",
    badge: "ZERO SHIM",
  },
  {
    kind: "http",
    title: "HTTP endpoint",
    body: "You own the agent loop. Preflight POSTs the conversation + tool schema; your endpoint returns the next action. ~20-line shim.",
  },
  {
    kind: "reference",
    title: "Built-in reference agent",
    body: "A deliberately imperfect support agent that ships with Preflight — live runs work with nothing external connected.",
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
    <div className="mx-auto max-w-2xl px-8 py-10">
      <div className="flex items-center justify-between">
        <Eyebrow>Live mode</Eyebrow>
        <Link href="/integration" className="focus-ring rounded text-[13px] text-accent hover:underline">
          Integration guide →
        </Link>
      </div>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">Connect an agent</h1>
      <p className="mt-2 text-sm leading-relaxed text-sub">
        Live mode runs your agent for real — against a simulated store seeded
        with realistic mess — and scores every transcript against the scenario
        rubrics. Nothing here is scripted.
      </p>

      <form
        className="mt-10 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          register({
            name: name || (kind === "reference" ? "Reference agent" : "Unnamed agent"),
            kind,
            endpoint: kind === "reference" ? undefined : endpoint,
            model: kind === "openai" ? model : undefined,
            authToken: authToken || undefined,
            systemPrompt: kind === "openai" ? systemPrompt || undefined : undefined,
          });
          setMode("live");
          router.push("/agents");
        }}
      >
        <div className="space-y-3">
          {options.map((o) => (
            <Card
              key={o.kind}
              className={`cursor-pointer p-5 transition-all duration-200 ${
                kind === o.kind ? "border-accent/50 bg-raised" : "hover:border-mut"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-4">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === o.kind}
                  onChange={() => {
                    setKind(o.kind);
                    setProbe(null);
                  }}
                  className="focus-ring mt-1 size-3.5 accent-accent"
                />
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    {o.title}
                    {o.badge && (
                      <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-accent">
                        {o.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-sub">{o.body}</p>
                </div>
              </label>
            </Card>
          ))}
        </div>

        <label className="block space-y-2">
          <Eyebrow>Agent name</Eyebrow>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "reference" ? "Reference agent" : "Aurora Support v1.4"}
          />
        </label>

        {needsEndpoint && (
          <label className="block space-y-2">
            <Eyebrow>
              {kind === "mcp"
                ? "MCP server URL"
                : kind === "openai"
                  ? "Base URL or chat-completions URL"
                  : "Endpoint URL"}
            </Eyebrow>
            <input
              className={inputCls}
              type="url"
              required
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value);
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
            <label className="block space-y-2">
              <Eyebrow>Model</Eyebrow>
              <input
                className={inputCls}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o"
              />
            </label>
            <label className="block space-y-2">
              <Eyebrow>System prompt · optional</Eyebrow>
              <textarea
                className={`${inputCls} h-28 font-mono text-[12px]`}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Your agent's system prompt — the thing that defines its behaviour. Paste it here so Preflight reproduces your agent, not a blank model."
              />
            </label>
          </>
        )}

        {(kind === "http" || kind === "openai") && (
          <label className="block space-y-2">
            <Eyebrow>{kind === "openai" ? "API key" : "Bearer token · optional"}</Eyebrow>
            <input
              className={inputCls}
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={kind === "openai" ? "sk-…" : "Sent as Authorization: Bearer …"}
            />
            <p className="text-[11px] text-mut">
              Sent as <code className="font-mono text-sub">Authorization: Bearer …</code> on every
              request to your endpoint. V0 stores it in this browser; production moves it to
              server-side secrets.
            </p>
          </label>
        )}

        {/* Test connection — one canned step, raw request/response inline. */}
        {(kind === "http" || kind === "openai") && (
          <div className="space-y-3 border-t border-edge pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-ink">Test the connection</div>
                <p className="mt-0.5 text-[13px] text-sub">
                  Fires one canned step at your endpoint — no run, no store changes.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={test} disabled={!canProbe || probing}>
                {probing ? "Testing…" : "Test connection"}
              </Button>
            </div>

            {probe && (
              <div
                className={`space-y-3 rounded-lg border p-4 ${
                  probe.ok ? "border-accent/40 bg-accent/8" : "border-warn/40 bg-warn/8"
                }`}
              >
                <div className={`text-[13px] font-medium ${probe.ok ? "text-accent" : "text-warn"}`}>
                  {probe.ok ? "✓ Connected" : "✗ Not connected"}
                  {probe.latencyMs ? (
                    <span className="ml-2 font-mono text-[11px] text-mut">{probe.latencyMs}ms</span>
                  ) : null}
                </div>
                <p className="text-[13px] text-sub">{probe.interpretation ?? probe.error}</p>
                {probe.request && (
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-mono text-[11px] tracking-wider text-mut">
                      RAW REQUEST → {probe.request.url}
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-sub">
                      {JSON.stringify(probe.request.body, null, 2)}
                    </pre>
                  </details>
                )}
                {probe.response && (
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-mono text-[11px] tracking-wider text-mut">
                      RAW RESPONSE · HTTP {probe.response.status}
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-sub">
                      {JSON.stringify(probe.response.body, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-edge pt-6">
          <p className="max-w-sm text-[12px] leading-relaxed text-mut">
            Live runs also need Preflight&apos;s own judge/persona model (never your agent). Set{" "}
            <code className="font-mono text-sub">PREFLIGHT_LLM_KEY</code> on the server.
          </p>
          <Button type="submit">Register agent</Button>
        </div>
      </form>
    </div>
  );
}
