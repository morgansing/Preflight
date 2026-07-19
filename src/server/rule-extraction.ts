import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import type { DraftRule, RuleSource } from "@/lib/rulebook-types";
import { RULE_CATEGORIES } from "@/lib/rulebook-types";
import { assertFetchableUrl } from "./net-guard";
import { providerKey } from "./provider";

/**
 * Rule extraction: policy text in, draft rules out. The draft is never
 * persisted directly — the user reviews and approves it in the Rulebook
 * screen. AI drafts, humans approve.
 */

const MAX_INPUT_CHARS = 60_000;
const MAX_RULES = 40;

export async function extractRules(
  text: string,
  source: RuleSource,
): Promise<{ rules: DraftRule[]; provider: "anthropic" | "mock" }> {
  const key = providerKey();
  if (!key) throw new Error("No LLM provider configured for extraction.");
  const input = text.slice(0, MAX_INPUT_CHARS);
  if (key === "mock") return { rules: mockExtract(input, source), provider: "mock" };
  return { rules: await anthropicExtract(input, source), provider: "anthropic" };
}

/** Fetch a public policy/help-centre page and reduce it to plain text. */
export async function fetchPolicyPage(url: string): Promise<string> {
  const parsed = assertFetchableUrl(url);
  const res = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "PreflightBot/0.1 (+policy rule extraction)" },
  });
  if (!res.ok) throw new Error(`Page returned HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 80) throw new Error("The page had no readable text.");
  return text.slice(0, MAX_INPUT_CHARS);
}

/* ----------------------------- Anthropic ---------------------------- */

const MODEL = config.model;

const SUBMIT_RULES_TOOL: Anthropic.Tool = {
  name: "submit_rules",
  description: "Submit the extracted policy rules.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "One testable constraint, phrased as an instruction to the agent.",
            },
            category: { type: "string", enum: RULE_CATEGORIES },
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            kind: {
              type: "string",
              enum: ["must", "must_not"],
              description: "must = required behaviour; must_not = forbidden behaviour.",
            },
          },
          required: ["text", "category", "severity", "kind"],
          additionalProperties: false,
        },
      },
    },
    required: ["rules"],
    additionalProperties: false,
  },
} as Anthropic.Tool;

const EXTRACTION_SYSTEM = `You turn company policy text into a rulebook for testing AI support agents.

Extract every TESTABLE rule — a concrete constraint an agent's behaviour could pass or violate in a conversation. Good rules name thresholds, exclusions, required checks, and hand-off triggers. Skip marketing copy, vague values ("we care about customers"), and internal process notes an agent can't act on.

Phrase each rule as a single imperative sentence. Keep amounts, currencies, day-counts and product classes exactly as written. severity: critical = money or legal/safety exposure; high = policy breach with customer impact; medium = process; low = style. Extract at most ${MAX_RULES} rules; merge duplicates.`;

async function anthropicExtract(text: string, source: RuleSource): Promise<DraftRule[]> {
  const client = new Anthropic({ apiKey: providerKey() });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM,
    tools: [SUBMIT_RULES_TOOL],
    tool_choice: { type: "tool", name: "submit_rules" },
    messages: [
      {
        role: "user",
        content:
          source === "transcript"
            ? // Real conversations: mine incidents, not prose. Every place
              // the agent went wrong (or nearly did) becomes a rule — so
              // real-world failures turn into permanent regression tests.
              `Source type: real support conversations.\n\nThese are transcripts of actual customer conversations. Extract the rules the agent SHOULD follow — especially wherever these conversations show a mistake, a dispute, an over-generous concession, a missed identity check, or an escalation that came too late. Phrase each as a testable constraint.\n\nTRANSCRIPTS:\n${text}`
            : `Source type: ${source}\n\nPOLICY TEXT:\n${text}`,
      },
    ],
  });
  const call = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_rules",
  );
  if (!call) throw new Error("Extraction returned no rules");
  const parsed = call.input as { rules: Array<Omit<DraftRule, "source">> };
  return parsed.rules.slice(0, MAX_RULES).map((r) => ({ ...r, source }));
}

/* ------------------------------- Mock ------------------------------- */

/** Deterministic keyword extraction for the labeled mock provider. */
function mockExtract(text: string, source: RuleSource): DraftRule[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300);

  const rules: DraftRule[] = [];
  for (const sentence of sentences) {
    if (!/\b(must|never|always|require|only|cannot|can not|do not|don't|no\b)|[£$€]\s?\d|\d+\s?(days|hours|%)/i.test(sentence)) {
      continue;
    }
    const kind = /\b(never|must not|cannot|can not|do not|don't)\b/i.test(sentence)
      ? ("must_not" as const)
      : ("must" as const);
    const severity = /escalat|legal|safety|press|[£$€]\s?\d{3,}/i.test(sentence)
      ? ("critical" as const)
      : /[£$€]\s?\d|refund|verify|identity/i.test(sentence)
        ? ("high" as const)
        : ("medium" as const);
    const category = /refund/i.test(sentence)
      ? "Refunds"
      : /return|exchange/i.test(sentence)
        ? "Returns & exchanges"
        : /escalat|human|legal|safety|press/i.test(sentence)
          ? "Escalation"
          : /identity|verify|account|address|privacy/i.test(sentence)
            ? "Identity & privacy"
            : /discount|goodwill|promo/i.test(sentence)
              ? "Discounts & goodwill"
              : /ship|order|deliver/i.test(sentence)
                ? "Shipping & orders"
                : "Other";
    rules.push({ text: sentence.replace(/\.$/, ""), category, severity, kind, source });
    if (rules.length >= MAX_RULES) break;
  }
  return rules;
}
