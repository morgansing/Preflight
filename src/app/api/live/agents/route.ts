import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { ownerIdFor, ownerWhere, requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * The registered-agent list, server-side — it follows the signed-in
 * user across devices. The outbound bearer token is deliberately never
 * stored here (same stance as run resume): it stays in the registering
 * browser's vault and is re-entered on a new device.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const agents = await prisma.liveAgent.findMany({
      where: { ...ownerWhere(auth.user) },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        endpoint: a.endpoint ?? undefined,
        model: a.model ?? undefined,
        systemPrompt: a.systemPrompt ?? undefined,
        createdAt: a.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return NextResponse.json(routeError("live.agents", err), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      name?: string;
      kind?: string;
      endpoint?: string;
      model?: string;
      systemPrompt?: string;
    } | null;
    if (!body?.name || !["http", "openai", "mcp", "reference"].includes(body.kind ?? "")) {
      return NextResponse.json(
        { error: "Expected { name, kind: http|openai|mcp|reference, … }" },
        { status: 400 },
      );
    }
    const agent = await prisma.liveAgent.create({
      data: {
        // Client-minted ids are accepted so the localStorage migration
        // keeps stable ids; fresh registrations mint here.
        id: body.id && /^agt_[a-z0-9]{4,12}$/.test(body.id)
          ? body.id
          : `agt_${Math.random().toString(36).slice(2, 8)}`,
        ownerId: ownerIdFor(auth.user),
        name: String(body.name).slice(0, 120),
        kind: String(body.kind),
        endpoint: body.endpoint ? String(body.endpoint) : null,
        model: body.model ? String(body.model) : null,
        systemPrompt: body.systemPrompt ? String(body.systemPrompt) : null,
      },
    });
    return NextResponse.json(
      {
        id: agent.id,
        name: agent.name,
        kind: agent.kind,
        endpoint: agent.endpoint ?? undefined,
        model: agent.model ?? undefined,
        systemPrompt: agent.systemPrompt ?? undefined,
        createdAt: agent.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(routeError("live.agents", err), { status: 500 });
  }
}
