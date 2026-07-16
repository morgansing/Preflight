import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { compareRuns, resolveBaselineRun } from "@/server/regression";

export const dynamic = "force-dynamic";

/**
 * This run versus its baseline. `report` is null when there is nothing
 * to compare against (first run of this agent + suite); `isBaseline`
 * says whether this run is itself the pinned baseline.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await prisma.liveRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const pin = await prisma.runBaseline.findUnique({
    where: { agentName_suite: { agentName: run.agentName, suite: run.suite } },
  });
  const isBaseline = pin?.runId === run.id;

  if (run.status !== "complete") {
    return NextResponse.json({
      isBaseline,
      report: null,
      reason: `Run is ${run.status} — comparison needs a completed run.`,
    });
  }

  const baseline = await resolveBaselineRun(prisma, run);
  if (!baseline) {
    return NextResponse.json({
      isBaseline,
      report: null,
      reason: "No earlier completed run of this agent + suite to compare against.",
    });
  }

  const report = await compareRuns(prisma, baseline, run.id);
  return NextResponse.json({ isBaseline, report });
}
