import { NextResponse, type NextRequest } from "next/server";
import { routeError } from "@/server/log";
import { sharedReport } from "@/server/share";

export const dynamic = "force-dynamic";

/** Public read-only report data for a shared run. No transcripts. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
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
