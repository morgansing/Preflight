import { NextResponse, type NextRequest } from "next/server";
import { createCheckout } from "@/server/billing";
import { routeError } from "@/server/log";
import { ownerIdFor, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Start a Checkout Session for a plan (subscription) or pack (payment). */
export async function POST(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as {
      kind?: "plan" | "pack";
      id?: string;
    } | null;
    if (!body?.id || (body.kind !== "plan" && body.kind !== "pack")) {
      return NextResponse.json({ error: "Expected { kind: plan|pack, id }" }, { status: 400 });
    }
    const origin = request.nextUrl.origin;
    const result = await createCheckout(ownerIdFor(auth.user), body.kind, body.id, origin);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(routeError("billing.checkout", err), { status: 500 });
  }
}
