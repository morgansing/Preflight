"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useLiveAgents, type ConnectionKind } from "@/lib/live";
import { useMode } from "@/lib/mode";

const inputCls =
  "focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-mut transition-shadow duration-200 focus:border-accent/50 " +
  "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-none";

const options: {
  kind: ConnectionKind;
  title: string;
  body: string;
}[] = [
  {
    kind: "http",
    title: "HTTP endpoint",
    body: "Preflight POSTs the conversation and tool schema; your agent returns its next action. The simplest integration.",
  },
  {
    kind: "mcp",
    title: "MCP endpoint",
    body: "Connect an agent that speaks the Model Context Protocol.",
  },
  {
    kind: "reference",
    title: "Built-in reference agent",
    body: "A deliberately imperfect support agent that ships with Preflight — live runs work with nothing external connected.",
  },
];

export default function ConnectAgentPage() {
  const router = useRouter();
  const { setMode } = useMode();
  const { register } = useLiveAgents();
  const [kind, setKind] = useState<ConnectionKind>("http");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <Eyebrow>Live mode</Eyebrow>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
        Connect an agent
      </h1>
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
            name:
              name ||
              (kind === "reference" ? "Reference agent" : "Unnamed agent"),
            kind,
            endpoint: kind === "reference" ? undefined : endpoint,
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
                kind === o.kind
                  ? "border-accent/50 bg-raised"
                  : "hover:border-mut"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-4">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === o.kind}
                  onChange={() => setKind(o.kind)}
                  className="focus-ring mt-1 size-3.5 accent-[#3ddc84]"
                />
                <div>
                  <div className="text-sm font-medium text-ink">{o.title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-sub">
                    {o.body}
                  </p>
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
            placeholder={
              kind === "reference" ? "Reference agent" : "Aurora Support v1.4"
            }
          />
        </label>

        {kind !== "reference" && (
          <label className="block space-y-2">
            <Eyebrow>{kind === "http" ? "Endpoint URL" : "MCP server URL"}</Eyebrow>
            <input
              className={inputCls}
              type="url"
              required
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={
                kind === "http"
                  ? "https://agents.example.com/preflight"
                  : "https://mcp.example.com/sse"
              }
            />
          </label>
        )}

        <div className="flex items-center justify-between border-t border-edge pt-6">
          <p className="max-w-sm text-[12px] leading-relaxed text-mut">
            Live runs additionally need an LLM provider key on the server
            (customer personas and the judge). Set{" "}
            <code className="font-mono text-sub">PREFLIGHT_LLM_KEY</code> in
            your environment.
          </p>
          <Button type="submit">Register agent</Button>
        </div>
      </form>
    </div>
  );
}
