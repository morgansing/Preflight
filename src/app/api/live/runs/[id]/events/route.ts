import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { subscribe } from "@/server/bus";
import type { LiveCellResult, LiveEvent } from "@/lib/live-types";

export const dynamic = "force-dynamic";

/**
 * SSE stream of run events with DB catch-up: on connect, every result
 * already persisted is replayed first, so a refreshed Mission Control
 * rebuilds the wall instead of losing it, then the live tail follows.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await prisma.liveRun.findUnique({
    where: { id },
    include: { results: true },
  });
  if (!run) return new Response("run not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      // Catch-up from the DB.
      const seen = new Set<string>();
      for (const r of run.results) {
        seen.add(r.scenarioId);
        send({
          type: "scenario_finished",
          result: {
            scenarioId: r.scenarioId,
            outcome: r.outcome as LiveCellResult["outcome"],
            failureReason: r.failureReason ?? undefined,
            severity: r.severity as LiveCellResult["severity"],
            tokens: r.tokens,
            costUsd: r.costUsd,
            latencyMs: r.latencyMs,
          },
        });
      }
      if (run.status !== "running") {
        send({
          type: "run_finished",
          status: run.status === "complete" ? "complete" : "error",
          error: run.error ?? undefined,
        });
        controller.close();
        return;
      }

      // Live tail. Dedupe against catch-up in case a result landed
      // between the DB read and the subscription.
      const unsubscribe = subscribe(id, (event) => {
        if (event.type === "scenario_finished" && seen.has(event.result.scenarioId)) return;
        if (event.type === "scenario_finished") seen.add(event.result.scenarioId);
        send(event);
        if (event.type === "run_finished") {
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      });

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(keepalive);
        }
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
