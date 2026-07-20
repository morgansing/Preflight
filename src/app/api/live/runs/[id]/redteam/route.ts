import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { ownerWhere, requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { startRedteamGeneration } from "@/server/generation";

export const dynamic = "force-dynamic";

/** Generate a red-team suite from this run's failure clusters. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const owned = await prisma.liveRun.findFirst({
      where: { id, ...ownerWhere(auth.user) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    const result = await startRedteamGeneration(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.redteam", err), { status: 500 });
  }
}
