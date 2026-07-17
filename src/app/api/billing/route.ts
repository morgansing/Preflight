import { NextResponse } from "next/server";
import { getBillingStatus } from "@/server/billing";
import { routeError } from "@/server/log";

export const dynamic = "force-dynamic";

/** One status shape in both modes: catalog, plan, balance, prefs. */
export async function GET() {
  try {
    return NextResponse.json(await getBillingStatus());
  } catch (err) {
    return NextResponse.json(routeError("billing.status", err), { status: 500 });
  }
}
