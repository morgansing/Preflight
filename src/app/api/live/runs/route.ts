import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { config } from "@/server/config";
import { debitRun, getAccount, precheckRun } from "@/server/billing";
import { launchRun } from "@/server/harness";
import { checkFreeAllowance, recordFreeUsage } from "@/server/free-grant";
import { plannedSimCount, toRunListItems } from "@/server/run-list";
import type { WorkspaceIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Queued plan steps stay off the list — they surface through their
    // plan, not as phantom history rows.
    const runs = await prisma.liveRun.findMany({
      where: { status: { not: "queued" } },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(await toRunListItems(runs));
  } catch (err) {
    return NextResponse.json(routeError("live.runs", err), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
  const body = await request.json().catch(() => ({}));
  const agentKind = body.agentKind as string;
  if (!["reference", "http", "openai", "mcp"].includes(agentKind)) {
    return NextResponse.json({ error: "agentKind must be reference | http | openai | mcp" }, { status: 400 });
  }
  const suite = String(body.suite ?? "smoke");
  const sandbox = body.sandbox === true;

  // Token metering. With billing connected and a paid subscription
  // active, the credit ledger is authoritative (allowance first, then
  // purchased tokens, with optional auto top-up). Otherwise the free
  // tier's identity-keyed grant applies. Sandbox runs (mock, offline)
  // never touch either.
  const plan = typeof body.plan === "string" ? body.plan : undefined;
  const identity = (body.identity ?? undefined) as WorkspaceIdentity | undefined;
  const identified = !!identity && (!!identity.email || !!identity.fingerprint);
  const sims = await plannedSimCount(suite);
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
            : `This run needs ${sims} simulations but only ${allow.remaining} of your free ${allow.allowance} remain. Add credits or start a plan.`,
          remaining: allow.remaining,
          allowance: allow.allowance,
          freeGrantBlocked: true,
        },
        { status: 402 },
      );
    }
  }

  const result = await launchRun({
    agentName: String(body.agentName ?? "Reference agent"),
    agentKind: agentKind as "reference" | "http" | "openai" | "mcp",
    endpoint: body.endpoint ? String(body.endpoint) : undefined,
    model: body.model ? String(body.model) : undefined,
    authToken: body.authToken ? String(body.authToken) : undefined,
    systemPrompt: body.systemPrompt ? String(body.systemPrompt) : undefined,
    suite,
    sandbox,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  // Charge once the run is actually launched (never for sandbox).
  if (ledgerMetered) {
    await debitRun(sims, result.runId);
  } else if (!sandbox && plan === "free" && identified) {
    await recordFreeUsage(prisma, identity!, sims);
  }
  return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.runs", err), { status: 500 });
  }
}
