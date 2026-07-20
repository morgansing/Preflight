import { NextResponse, type NextRequest } from "next/server";
import { getBillingStatus } from "@/server/billing";
import { routeError } from "@/server/log";
import { ownerIdFor, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/** One status shape in both modes: catalog, plan, balance, prefs. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await getBillingStatus(ownerIdFor(auth.user)));
  } catch (err) {
    return NextResponse.json(routeError("billing.status", err), { status: 500 });
  }
}
