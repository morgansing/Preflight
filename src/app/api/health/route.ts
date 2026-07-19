import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { config } from "@/server/config";

export const dynamic = "force-dynamic";

// Read once per process — the deploy's identity for uptime dashboards.
let version = "unknown";
try {
  version = (
    JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      version?: string;
    }
  ).version ?? "unknown";
} catch {
  // leave "unknown"
}

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
      version,
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
