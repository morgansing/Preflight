import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { checkFreeAllowance } from "@/server/free-grant";

export const dynamic = "force-dynamic";

/**
 * How much of the free grant an identity has left. Query with the
 * workspace's email and/or device fingerprint; the answer reflects the
 * server ledger, so alias emails and repeat browsers share one grant.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const email = q.get("email") ?? undefined;
  const fingerprint = q.get("fp") ?? undefined;
  const allowance = await checkFreeAllowance(prisma, { email, fingerprint });
  return NextResponse.json(allowance);
}
