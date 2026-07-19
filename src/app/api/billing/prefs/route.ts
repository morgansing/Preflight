import { NextResponse, type NextRequest } from "next/server";
import { updatePrefs } from "@/server/billing";
import { routeError } from "@/server/log";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Auto top-up preference + (Stripe-dormant) preview pack purchases. */
export async function POST(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = requireUser(request);
  if (auth.response) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as {
      autoTopUp?: boolean;
      autoTopUpPackId?: string | null;
      mockPackId?: string;
    } | null;
    if (!body) return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    return NextResponse.json(await updatePrefs(body));
  } catch (err) {
    return NextResponse.json(routeError("billing.prefs", err), { status: 500 });
  }
}
