import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Baseline pins. POST { runId } pins that completed run as the baseline
 * for its (agentName, suite) — the reference every later run is diffed
 * against. Typical flow: the main-branch CI job pins its run; PR runs
 * gate against it.
 */

export async function GET() {
  try {
  const pins = await prisma.runBaseline.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(pins);
  } catch (err) {
    return NextResponse.json(routeError("live.baseline", err), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
  const body = (await request.json().catch(() => null)) as { runId?: string } | null;
  if (!body?.runId) {
    return NextResponse.json({ error: "Expected { runId }" }, { status: 400 });
  }
  const run = await prisma.liveRun.findUnique({ where: { id: body.runId } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "complete") {
    return NextResponse.json(
      { error: `Run is ${run.status} — only a completed run can be a baseline.` },
      { status: 400 },
    );
  }
  const pin = await prisma.runBaseline.upsert({
    where: { agentName_suite: { agentName: run.agentName, suite: run.suite } },
    create: { agentName: run.agentName, suite: run.suite, runId: run.id },
    update: { runId: run.id, createdAt: new Date() },
  });
  return NextResponse.json(pin, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.baseline", err), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
  const body = (await request.json().catch(() => null)) as {
    agentName?: string;
    suite?: string;
  } | null;
  if (!body?.agentName || !body?.suite) {
    return NextResponse.json({ error: "Expected { agentName, suite }" }, { status: 400 });
  }
  await prisma.runBaseline
    .delete({
      where: { agentName_suite: { agentName: body.agentName, suite: body.suite } },
    })
    .catch(() => null);
  return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(routeError("live.baseline", err), { status: 500 });
  }
}
