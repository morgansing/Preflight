import { NextResponse, type NextRequest } from "next/server";
import { extractRules, fetchPolicyPage } from "@/server/rule-extraction";
import { providerKey } from "@/server/provider";
import type { RuleSource } from "@/lib/rulebook-types";

export const dynamic = "force-dynamic";

/**
 * POST { input: "url" | "text", content, source } → { rules: DraftRule[] }
 * Drafts only — nothing persists until the user approves the rulebook.
 */
export async function POST(request: NextRequest) {
  if (!providerKey()) {
    return NextResponse.json(
      {
        error:
          "Rule extraction needs an LLM provider — set PREFLIGHT_LLM_KEY (or ANTHROPIC_API_KEY). The questionnaire path works without one.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    input: "url" | "text";
    content: string;
    source: RuleSource;
  } | null;
  if (!body?.content || !["url", "text"].includes(body.input)) {
    return NextResponse.json({ error: "Expected { input: url|text, content, source }" }, { status: 400 });
  }

  try {
    const text =
      body.input === "url" ? await fetchPolicyPage(body.content.trim()) : body.content;
    const source: RuleSource = body.source ?? (body.input === "url" ? "help_centre" : "document");
    const { rules, provider } = await extractRules(text, source);
    if (rules.length === 0) {
      return NextResponse.json(
        { error: "No testable rules found in that text — try the questionnaire, or paste a more specific policy section." },
        { status: 422 },
      );
    }
    return NextResponse.json({ rules, provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
