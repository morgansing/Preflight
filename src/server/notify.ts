import { config } from "./config";
import { prisma } from "./db";
import { log } from "./log";
import { assertFetchableUrl } from "./net-guard";
import { compareRuns, resolveBaselineRun } from "./regression";

/**
 * Webhook notifications — Slack-compatible payloads posted when a run
 * completes, with a second, louder message when it regressed against
 * its baseline. Fire-and-forget: a dead webhook never blocks a run.
 */

async function post(text: string): Promise<void> {
  const url = config.webhookUrl;
  if (!url) return;
  try {
    assertFetchableUrl(url);
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    log.warn("notify", "webhook delivery failed", { err: String(err) });
  }
}

/** Called after a run finishes (success or error). */
export async function notifyRunFinished(runId: string): Promise<void> {
  if (!config.webhookUrl) return;
  try {
    const run = await prisma.liveRun.findUnique({ where: { id: runId } });
    if (!run) return;

    if (run.status === "error") {
      await post(`⚠️ Preflight run *${run.id}* (${run.agentName} · ${run.suite}) ended in a run error: ${run.error ?? "unknown"}`);
      return;
    }

    const grouped = await prisma.liveResult.groupBy({
      by: ["outcome"],
      _count: { _all: true },
      where: { runId },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.outcome] = g._count._all;
    const scored = (counts.pass ?? 0) + (counts.fail ?? 0) + (counts.partial ?? 0);
    const score = scored ? Math.round(((counts.pass ?? 0) / scored) * 100) : 0;

    await post(
      `✅ Preflight run *${run.id}* complete — ${run.agentName} · ${run.suite} · *${score}%* (✓${counts.pass ?? 0} ✗${counts.fail ?? 0} ◐${counts.partial ?? 0})`,
    );

    // Louder message when the run regressed against its baseline.
    const baseline = await resolveBaselineRun(prisma, run);
    if (!baseline) return;
    const report = await compareRuns(prisma, baseline, runId);
    if (report.regressions.length > 0) {
      const top = report.regressions
        .slice(0, 3)
        .map((r) => `• ${r.scenarioId} ${r.name ?? ""} (${r.from}→${r.to})`)
        .join("\n");
      await post(
        `🔴 *Regression* in ${run.agentName} · ${run.suite}: ${report.regressions.length} scenario(s) got worse vs ${baseline.id} (${report.baselineScore}%→${report.candidateScore}%)\n${top}`,
      );
    }
  } catch (err) {
    log.warn("notify", "notifyRunFinished failed", { err: String(err) });
  }
}
