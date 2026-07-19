import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { config } from "@/server/config";
import { debitRun, getAccount, precheckRun } from "@/server/billing";
import { launchPlan } from "@/server/harness";
import { checkFreeAllowance, recordFreeUsage } from "@/server/free-grant";
import { plannedSimCount } from "@/server/run-list";
import type { WorkspaceIdentity } from "@/lib/identity";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Launch a flight plan: several suites as one job, run sequentially.
 * Credits for the whole plan are checked and charged up front — one
 * decision, one price, exactly what the preset card displayed.
 */
export async function POST(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = requireUser(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const agentKind = body.agentKind as string;
    if (!["reference", "http", "openai", "mcp"].includes(agentKind)) {
      return NextResponse.json(
        { error: "agentKind must be reference | http | openai | mcp" },
        { status: 400 },
      );
    }
    const suites = Array.isArray(body.suites) ? body.suites.map(String) : [];
    if (suites.length === 0 || suites.length > 6) {
      return NextResponse.json({ error: "suites must list 1–6 suite ids." }, { status: 400 });
    }
    const planKind = String(body.planKind ?? "custom");
    const sandbox = body.sandbox === true;

    // Same metering rules as single runs, applied to the plan total.
    const plan = typeof body.plan === "string" ? body.plan : undefined;
    const identity = (body.identity ?? undefined) as WorkspaceIdentity | undefined;
    const identified = !!identity && (!!identity.email || !!identity.fingerprint);
    let sims = 0;
    for (const suite of suites) sims += await plannedSimCount(suite);
    const account = !sandbox ? await getAccount() : null;
    const ledgerMetered =
      !!account && config.billing.enabled && account.subscriptionStatus === "active";
    if (ledgerMetered) {
      const pre = await precheckRun(sims);
      if (!pre.ok) {
        return NextResponse.json({ error: pre.reason, freeGrantBlocked: true }, { status: 402 });
      }
    }
    if (!sandbox && !ledgerMetered && plan === "free" && identified) {
      const allow = await checkFreeAllowance(prisma, identity!);
      if (allow.blocked || sims > allow.remaining) {
        return NextResponse.json(
          {
            error: allow.blocked
              ? `Your ${allow.allowance} free simulations are used up. Add credits or start a plan to keep running.`
              : `This job needs ${sims} simulations but only ${allow.remaining} of your free ${allow.allowance} remain. Add credits or start a plan.`,
            remaining: allow.remaining,
            allowance: allow.allowance,
            freeGrantBlocked: true,
          },
          { status: 402 },
        );
      }
    }

    const result = await launchPlan(
      {
        agentName: String(body.agentName ?? "Reference agent"),
        agentKind: agentKind as "reference" | "http" | "openai" | "mcp",
        endpoint: body.endpoint ? String(body.endpoint) : undefined,
        model: body.model ? String(body.model) : undefined,
        authToken: body.authToken ? String(body.authToken) : undefined,
        systemPrompt: body.systemPrompt ? String(body.systemPrompt) : undefined,
        sandbox,
      },
      suites,
      planKind,
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (ledgerMetered) {
      await debitRun(sims, result.runIds[0]);
    } else if (!sandbox && plan === "free" && identified) {
      await recordFreeUsage(prisma, identity!, sims);
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.plan", err), { status: 500 });
  }
}
