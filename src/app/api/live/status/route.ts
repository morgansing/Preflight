import { NextResponse } from "next/server";
import { providerKey } from "@/server/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = providerKey();
  return NextResponse.json({
    provider: key ? (key === "mock" ? "mock" : "anthropic") : null,
  });
}
