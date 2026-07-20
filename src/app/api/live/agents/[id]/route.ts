import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { ownerWhere, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const { count } = await prisma.liveAgent.deleteMany({
      where: { id, ...ownerWhere(auth.user) },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(routeError("live.agents", err), { status: 500 });
  }
}
