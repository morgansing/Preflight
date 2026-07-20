import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { ownerWhere, requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { ensureShareToken } from "@/server/share";

export const dynamic = "force-dynamic";

/** Mint (or return) the public share token for a completed run. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Minting is a workspace action — dormant-gated like every mutation.
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const owned = await prisma.liveRun.findFirst({
      where: { id, ...ownerWhere(auth.user) },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    const token = await ensureShareToken(id);
    if (!token) {
      return NextResponse.json(
        { error: "Only completed runs can be shared." },
        { status: 409 },
      );
    }
    return NextResponse.json({ token });
  } catch (err) {
    return NextResponse.json(routeError("share.mint", err), { status: 500 });
  }
}
