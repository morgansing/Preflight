import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { config } from "@/server/config";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and deploy verification. Reports
 * which subsystems are active — never their secrets.
 */
export async function GET() {
  let db = false;
  try {
    await prisma.liveRun.count({ take: 1 });
    db = true;
  } catch {
    // fall through — ok:false below
  }
  return NextResponse.json(
    {
      ok: db,
      db,
      provider: config.llmKey ? (config.llmKey === "mock" ? "mock" : "configured") : "sandbox-only",
      billing: config.billing.enabled ? "active" : "dormant",
      auth: config.auth.enabled ? "active" : "open",
      webhook: !!config.webhookUrl,
      retentionDays: config.retentionDays,
    },
    { status: db ? 200 : 503 },
  );
}
