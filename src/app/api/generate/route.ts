import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { latestSuite, startGeneration } from "@/server/generation";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** GET → latest suite status + scenario summaries when ready. */
export async function GET() {
  try {
  const suite = await latestSuite();
  if (!suite) return NextResponse.json({ suite: null });
  const scenarios =
    suite.status === "ready"
      ? (
          await prisma.customScenario.findMany({
            where: { suiteVersion: suite.version },
            orderBy: { id: "asc" },
            select: { id: true, name: true, category: true, severity: true, ruleText: true, pressureJson: true },
          })
        ).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          severity: s.severity,
          ruleText: s.ruleText,
          pressure: JSON.parse(s.pressureJson),
        }))
      : [];
  return NextResponse.json({ suite, scenarios });
  } catch (err) {
    return NextResponse.json(routeError("generate", err), { status: 500 });
  }
}

/** POST { perRule } → start generating a new suite from the approved rulebook. */
export async function POST(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
  const body = await request.json().catch(() => ({}));
  const result = await startGeneration(Number(body.perRule ?? 6));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("generate", err), { status: 500 });
  }
}
