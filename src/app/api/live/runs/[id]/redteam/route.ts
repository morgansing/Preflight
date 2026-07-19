import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { requireUser } from "@/server/auth";
import { startRedteamGeneration } from "@/server/generation";

export const dynamic = "force-dynamic";

/** Generate a red-team suite from this run's failure clusters. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireUser(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const result = await startRedteamGeneration(id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.redteam", err), { status: 500 });
  }
}
