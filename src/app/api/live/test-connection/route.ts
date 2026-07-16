import { NextResponse, type NextRequest } from "next/server";
import { STORE_TOOLS } from "@/server/store-tools";
import { chatCompletionsUrl, openAiTools } from "@/server/openai-agent";

export const dynamic = "force-dynamic";

/**
 * Test-connection probe: fire ONE canned scenario step at the agent
 * endpoint and return the raw request + response, so the first
 * integration bug costs a click, not a whole run. Uses a stub tool
 * result — it never touches the real store.
 */

const CANNED_CONVERSATION = [
  { role: "customer" as const, text: "Hi — can you check the status of my order #A38423?" },
];

const redact = (h: Record<string, string>) => {
  const out = { ...h };
  if (out.authorization) out.authorization = "Bearer ••••••••";
  return out;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    agentKind: "http" | "openai";
    endpoint: string;
    model?: string;
    authToken?: string;
    systemPrompt?: string;
  } | null;

  if (!body?.endpoint || !["http", "openai"].includes(body.agentKind)) {
    return NextResponse.json(
      { error: "Expected { agentKind: http|openai, endpoint, … }" },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  try {
    if (body.agentKind === "http") {
      const headers = {
        "content-type": "application/json",
        ...(body.authToken ? { authorization: `Bearer ${body.authToken}` } : {}),
      };
      const reqBody = { conversation: CANNED_CONVERSATION, actions_so_far: [], tools: STORE_TOOLS };
      const res = await fetch(body.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      const parsed = safeJson(text);
      const action = parsed as { action?: string; tool?: string; text?: string } | null;
      return NextResponse.json({
        ok: res.ok && !!action?.action,
        latencyMs: Date.now() - t0,
        request: { url: body.endpoint, method: "POST", headers: redact(headers), body: reqBody },
        response: { status: res.status, body: parsed ?? text.slice(0, 1000) },
        interpretation: !res.ok
          ? `Endpoint returned HTTP ${res.status}.`
          : action?.action === "tool_call"
            ? `✓ Agent returned a tool call: ${action.tool}. Wire format looks correct.`
            : action?.action === "reply"
              ? `✓ Agent replied with text. Wire format looks correct.`
              : `Reached the endpoint, but the response has no { action } field — check the wire contract.`,
      });
    }

    // openai-compatible
    const url = chatCompletionsUrl(body.endpoint);
    const headers = {
      "content-type": "application/json",
      ...(body.authToken ? { authorization: `Bearer ${body.authToken}` } : {}),
    };
    const reqBody = {
      model: body.model ?? "gpt-4o",
      messages: [
        { role: "system", content: body.systemPrompt?.trim() || "You are a support agent for an online store." },
        { role: "user", content: CANNED_CONVERSATION[0].text },
      ],
      tools: openAiTools(),
      tool_choice: "auto",
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    const parsed = safeJson(text) as
      | { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function?: { name?: string } }> } }> }
      | null;
    const msg = parsed?.choices?.[0]?.message;
    const toolName = msg?.tool_calls?.[0]?.function?.name;
    return NextResponse.json({
      ok: res.ok && !!msg,
      latencyMs: Date.now() - t0,
      request: {
        url,
        method: "POST",
        headers: redact(headers),
        body: { ...reqBody, tools: `[${reqBody.tools.length} store tools]` },
      },
      response: { status: res.status, body: parsed ?? text.slice(0, 1000) },
      interpretation: !res.ok
        ? `Endpoint returned HTTP ${res.status}.`
        : toolName
          ? `✓ Model returned a tool call: ${toolName}. Preflight will drive the tool loop.`
          : msg?.content
            ? `✓ Model replied with text and accepted the tool schema. Looks good.`
            : `Reached the endpoint, but no choices/message came back — check the model name and URL.`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
      interpretation:
        "Couldn't reach the endpoint. Check the URL is correct and reachable from Preflight's server (public URL or a tunnel).",
    });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
