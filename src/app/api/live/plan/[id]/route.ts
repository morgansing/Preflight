import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { toRunListItems } from "@/server/run-list";
import { ownerWhere, requireUser } from "@/server/auth";
import type { LivePlan } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const runs = await prisma.liveRun.findMany({
      where: { planId: id, ...ownerWhere(auth.user) },
      orderBy: { planStep: "asc" },
    });
    if (runs.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    const items = await toRunListItems(runs);
    const plan: LivePlan = {
      planId: id,
      planKind: runs[0].planKind ?? "custom",
      agentName: runs[0].agentName,
      runs: items,
      done: items.every((r) => r.status === "complete" || r.status === "error"),
    };
    return NextResponse.json(plan);
  } catch (err) {
    return NextResponse.json(routeError("live.plan", err), { status: 500 });
  }
}
