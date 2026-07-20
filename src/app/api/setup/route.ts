import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import type { AgentProfile, PolicyRule } from "@/lib/rulebook-types";
import { ownerIdFor, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const profileId = ownerIdFor(auth.user);
  try {
  const profile = await prisma.agentProfile.findUnique({ where: { id: profileId } });
  const rules = await prisma.policyRule.findMany({
    where: { profileId },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({
    profile: profile
      ? {
          role: profile.role,
          agentRef: profile.agentRef,
          tools: JSON.parse(profile.toolsJson),
        }
      : null,
    rules: rules.map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category,
      severity: r.severity,
      kind: r.kind,
      source: r.source,
      enabled: r.enabled,
    })),
  });
  } catch (err) {
    return NextResponse.json(routeError("setup", err), { status: 500 });
  }
}

/** Save the whole setup atomically: profile + the approved rulebook. */
export async function PUT(request: NextRequest) {
  // Dormant until SUPABASE_JWT_SECRET exists; then a verified user is required.
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const profileId = ownerIdFor(auth.user);
  try {
  const body = (await request.json().catch(() => null)) as {
    profile: AgentProfile;
    rules: Array<Omit<PolicyRule, "id">>;
  } | null;
  if (!body?.profile || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: "Expected { profile, rules }" }, { status: 400 });
  }
  if (body.rules.length > 200) {
    return NextResponse.json({ error: "Rulebook is capped at 200 rules" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.agentProfile.upsert({
      where: { id: profileId },
      create: {
        id: profileId,
        role: body.profile.role,
        agentRef: body.profile.agentRef,
        toolsJson: JSON.stringify(body.profile.tools ?? []),
      },
      update: {
        role: body.profile.role,
        agentRef: body.profile.agentRef,
        toolsJson: JSON.stringify(body.profile.tools ?? []),
      },
    }),
    prisma.policyRule.deleteMany({ where: { profileId } }),
    prisma.policyRule.createMany({
      data: body.rules.map((r) => ({
        profileId,
        text: String(r.text).slice(0, 500),
        category: String(r.category),
        severity: String(r.severity),
        kind: r.kind === "must_not" ? "must_not" : "must",
        source: String(r.source),
        enabled: r.enabled !== false,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, ruleCount: body.rules.length });
  } catch (err) {
    return NextResponse.json(routeError("setup", err), { status: 500 });
  }
}
