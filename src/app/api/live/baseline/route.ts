import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { ownerIdFor, ownerWhere, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Baseline pins. POST { runId } pins that completed run as the baseline
 * for its (agentName, suite) — the reference every later run is diffed
 * against. Typical flow: the main-branch CI job pins its run; PR runs
 * gate against it.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
  const pins = await prisma.runBaseline.findMany({
    where: { ...ownerWhere(auth.user) },
    orderBy: { createdAt: "desc" },
  });
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
  const run = await prisma.liveRun.findFirst({
    where: { id: body.runId, ...ownerWhere(auth.user) },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status !== "complete") {
    return NextResponse.json(
      { error: `Run is ${run.status} — only a completed run can be a baseline.` },
      { status: 400 },
    );
  }
  const pin = await prisma.runBaseline.upsert({
    where: {
      ownerId_agentName_suite: {
        ownerId: run.ownerId,
        agentName: run.agentName,
        suite: run.suite,
      },
    },
    create: { ownerId: run.ownerId, agentName: run.agentName, suite: run.suite, runId: run.id },
    update: { runId: run.id, createdAt: new Date() },
  });
  return NextResponse.json(pin, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.baseline", err), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
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
      where: {
        ownerId_agentName_suite: {
          ownerId: ownerIdFor(auth.user),
          agentName: body.agentName,
          suite: body.suite,
        },
      },
    })
    .catch(() => null);
  return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(routeError("live.baseline", err), { status: 500 });
  }
}
