import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { requireUser } from "@/server/auth";
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
