"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Eyebrow } from "@/components/ui";

/**
 * Integration guide: the wire contract for connecting an agent to
 * Preflight. Two paths — a zero-shim OpenAI-compatible endpoint, and a
 * ~20-line HTTP shim for teams that own their agent loop — plus the store
 * tool surface both paths drive. Copy-paste templates included.
 */

const STORE_TOOLS: { name: string; args: string; note: string }[] = [
  { name: "get_order", args: "order_id", note: "Status, items, totals, payment, address, shipping, refunds, policy flags." },
  { name: "search_orders", args: "customer_id | email, placed_within_hours?", note: "Find a customer's orders — the duplicate-charge starting point." },
  { name: "get_customer", args: "customer_id | email", note: "Profile + 90-day refund-claim history (the abuse signal)." },
  { name: "check_stock", args: "sku | name", note: "Live stock + restock date (and whether it's confirmed)." },
  { name: "issue_refund", args: "order_id, amount, reason, destination?", note: "Real, run-scoped. destination defaults to original payment." },
  { name: "cancel_order", args: "order_id, reason?", note: "Only before delivery." },
  { name: "create_return", args: "order_id, reason?, override_final_sale?", note: "Opens an RMA. The override is the final-sale trap." },
  { name: "update_address", args: "order_id, address", note: "Only before the carrier locks the address." },
  { name: "escalate", args: "summary, trigger, order_id?", note: "Hand to a human — legal threats, over-threshold refunds, safety." },
];

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  return (
    <div className="group relative">
      {lang && (
        <span className="absolute left-3 top-2.5 font-mono text-[10px] tracking-[0.14em] text-mut">
          {lang.toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        className="focus-ring absolute right-2 top-2 rounded border border-edge bg-bg/70 px-2 py-1 font-mono text-[10px] tracking-wider text-mut opacity-0 transition-opacity duration-150 hover:text-ink group-hover:opacity-100"
      >
        {copied ? "COPIED" : "COPY"}
      </button>
      <pre className="overflow-x-auto rounded-lg border border-edge bg-bg/60 p-4 pt-8 font-mono text-[12px] leading-relaxed text-sub">
        {code}
      </pre>
    </div>
  );
}

const CURL_OPENAI = `curl https://YOUR-ENDPOINT/v1/chat/completions \\
  -H "authorization: Bearer $YOUR_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "your-model",
    "messages": [
      {"role": "user", "content": "check order #A38423"}
    ],
    "tools": [ /* Preflight injects the 9 store tools */ ],
    "tool_choice": "auto"
  }'
# A tool_calls response = wired correctly. Preflight drives the loop.`;

const SHIM_REQUEST = `POST https://your-agent/preflight
authorization: Bearer <your token>        // optional, if you set one
content-type: application/json

{
  "conversation": [
    { "role": "customer", "text": "Where's my order #A38423?" },
    { "role": "agent",    "text": "Let me check…" }
  ],
  "actions_so_far": [
    { "tool": "get_order",
      "input":  { "order_id": "A38423" },
      "result": { "status": "shipped", "total": 84.0, "...": "..." } }
  ],
  "tools": [ /* the 9 store-tool JSON schemas, Anthropic style */ ]
}`;

const SHIM_RESPONSE = `// Call a tool — Preflight runs it and calls you back with the result:
{ "action": "tool_call", "tool": "get_order", "input": { "order_id": "A38423" } }

// …or reply to the customer, which ends your turn:
{ "action": "reply", "text": "Your order shipped Tuesday and is out for delivery today." }`;

const EXPRESS = `import express from "express";
const app = express();
app.use(express.json());

// Your agent, behind Preflight's wire contract. ~20 lines.
app.post("/preflight", async (req, res) => {
  const { conversation, actions_so_far, tools } = req.body;

  // Hand the state to however your agent decides its next step.
  const step = await myAgent.next({ conversation, actions_so_far, tools });

  if (step.type === "tool") {
    return res.json({ action: "tool_call", tool: step.name, input: step.input });
  }
  return res.json({ action: "reply", text: step.text });
});

app.listen(8080);`;

const FASTAPI = `from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/preflight")
async def preflight(req: Request):
    body = await req.json()
    conversation   = body["conversation"]
    actions_so_far = body["actions_so_far"]
    tools          = body["tools"]

    step = my_agent.next(conversation, actions_so_far, tools)

    if step.kind == "tool":
        return {"action": "tool_call", "tool": step.name, "input": step.input}
    return {"action": "reply", "text": step.text}`;

export default function IntegrationPage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <Eyebrow>Live mode</Eyebrow>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">Integration guide</h1>
      <p className="mt-3 text-sm leading-relaxed text-sub">
        Preflight runs <em>your</em> agent against a simulated store — no scripts, no mocks of
        your side. There are two ways to connect, depending on whether your agent already speaks
        the OpenAI dialect or you drive your own loop. Either way, Preflight owns the customer
        persona and the judge; you own the agent.
      </p>

      {/* Path 1 */}
      <section className="mt-12">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl text-ink">1 · OpenAI-compatible endpoint</h2>
          <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-accent">
            ZERO SHIM
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          If your agent is an endpoint that speaks the <code className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-sub">chat/completions</code>{" "}
          tool-calling dialect — OpenAI, Azure OpenAI, vLLM/TGI, or a framework backend
          (LangChain, CrewAI, the Vercel AI SDK) — there is nothing to build. Give Preflight the
          base URL, model name, API key, and your agent&apos;s system prompt. Preflight injects the
          store tools, runs the multi-turn loop, executes each tool call against the real store,
          and feeds results back until your agent replies.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          Verify it in one request before you register — or just use{" "}
          <span className="text-ink">Test connection</span> on the connect form:
        </p>
        <div className="mt-4">
          <CodeBlock code={CURL_OPENAI} lang="bash" />
        </div>
      </section>

      {/* Path 2 */}
      <section className="mt-14">
        <h2 className="font-display text-xl text-ink">2 · HTTP endpoint (your own loop)</h2>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          If you own the agent&apos;s control flow and don&apos;t expose an OpenAI-style API, stand up
          one endpoint. Preflight POSTs the conversation so far, every tool result so far, and the
          tool schemas; you return the single next action. Preflight calls you again with the
          result until you reply. That&apos;s the whole contract.
        </p>

        <div className="mt-5 space-y-1.5">
          <Eyebrow>What Preflight sends you</Eyebrow>
        </div>
        <div className="mt-2">
          <CodeBlock code={SHIM_REQUEST} lang="http" />
        </div>

        <div className="mt-5 space-y-1.5">
          <Eyebrow>What you return</Eyebrow>
        </div>
        <div className="mt-2">
          <CodeBlock code={SHIM_RESPONSE} lang="json" />
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 font-mono text-[11px] tracking-[0.14em] text-mut">NODE · EXPRESS</div>
            <CodeBlock code={EXPRESS} />
          </div>
          <div>
            <div className="mb-2 font-mono text-[11px] tracking-[0.14em] text-mut">PYTHON · FASTAPI</div>
            <CodeBlock code={FASTAPI} />
          </div>
        </div>
      </section>

      {/* Tool surface */}
      <section className="mt-14">
        <h2 className="font-display text-xl text-ink">The store tool surface</h2>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          Both paths drive the same nine tools. They&apos;re honest — they report real state and
          perform real, run-scoped mutations. They will let your agent make a bad call (issue an
          over-threshold refund, override a final sale); catching poor judgement is the judge&apos;s
          job, not the store&apos;s. That&apos;s the point.
        </p>
        <Card className="mt-5 divide-y divide-edge p-0">
          {STORE_TOOLS.map((t) => (
            <div key={t.name} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-4">
              <div className="sm:w-44 shrink-0">
                <code className="font-mono text-[13px] text-accent">{t.name}</code>
                <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-mut">{t.args}</div>
              </div>
              <p className="text-[13px] leading-relaxed text-sub">{t.note}</p>
            </div>
          ))}
        </Card>
      </section>

      {/* Auth + judge notes */}
      <section className="mt-14 grid gap-5 md:grid-cols-2">
        <Card className="space-y-2">
          <Eyebrow>Outbound auth</Eyebrow>
          <p className="text-[13px] leading-relaxed text-sub">
            Set an API key / bearer token on the connect form and Preflight sends it as{" "}
            <code className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-sub">Authorization: Bearer …</code> on every request to your
            endpoint — so you can keep it private. V0 stores it in your browser; production moves it
            to server-side encrypted secrets.
          </p>
        </Card>
        <Card className="space-y-2">
          <Eyebrow>The judge is never your agent</Eyebrow>
          <p className="text-[13px] leading-relaxed text-sub">
            The customer persona and the scoring judge are always Preflight&apos;s own trusted model,
            configured on the server (<code className="rounded bg-raised px-1 py-0.5 font-mono text-[0.85em] text-sub">PREFLIGHT_LLM_KEY</code>). Your
            endpoint is only ever the agent under test — it never grades itself.
          </p>
        </Card>
      </section>

      <section className="mt-14 flex items-center justify-between border-t border-edge pt-6">
        <p className="text-[13px] text-mut">Reachability note: your endpoint must be reachable from Preflight&apos;s server — a public URL or a tunnel (ngrok, Cloudflare Tunnel).</p>
        <Link
          href="/agents/connect"
          className="focus-ring shrink-0 rounded text-[13px] font-medium text-accent hover:underline"
        >
          Connect an agent →
        </Link>
      </section>
    </div>
  );
}
