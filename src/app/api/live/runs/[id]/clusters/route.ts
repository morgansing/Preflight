import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { getClusterReport } from "@/server/clustering";
import { getProvider } from "@/server/provider";
import type { ClusterReport } from "@/lib/live-types";

export const dynamic = "force-dynamic";

/**
 * Root-cause clusters for a completed run. Computed once on first
 * request (grouping + provider naming) and cached on the run — the
 * failures don't change after completion.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await prisma.liveRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status === "running") {
    return NextResponse.json({ status: "running" }, { status: 202 });
  }
  if (run.clustersJson) {
    return NextResponse.json(JSON.parse(run.clustersJson) as ClusterReport);
  }

  const provider = await getProvider();
  const report = await getClusterReport(prisma, id, provider);
  await prisma.liveRun.update({
    where: { id },
    data: { clustersJson: JSON.stringify(report) },
  });
  return NextResponse.json(report);
}
