import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { sharedReport } from "@/server/share";
import { clientKey, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** Public read-only report data for a shared run. No transcripts. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    if (!rateLimit(`share:${clientKey(request)}`)) {
      return NextResponse.json(
        { error: "Rate limited — try again shortly." },
        { status: 429, headers: { "retry-after": "2" } },
      );
    }
    const { token } = await params;
    const report = await sharedReport(token);
    if (!report) {
      return NextResponse.json({ error: "Unknown share link." }, { status: 404 });
    }
    return NextResponse.json(report, {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch (err) {
    return NextResponse.json(routeError("share.report", err), { status: 500 });
  }
}
