import { NextResponse, type NextRequest } from "next/server";
import { createPortal } from "@/server/billing";
import { routeError } from "@/server/log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const result = await createPortal(request.nextUrl.origin);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(routeError("billing.portal", err), { status: 500 });
  }
}
