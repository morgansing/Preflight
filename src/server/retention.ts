import { config } from "./config";
import { prisma } from "./db";
import { log } from "./log";

/**
 * Transcript retention. Scores, outcomes, and failure reasons are kept
 * forever — they're the product's memory. Transcript and judge JSON
 * (the heavy, sensitive payload) are pruned after
 * PREFLIGHT_RETENTION_DAYS when set. Runs opportunistically — after
 * run completion and on boot — so no scheduler is needed.
 */

const PRUNED = "[]";

export async function pruneOldTranscripts(): Promise<void> {
  const days = config.retentionDays;
  if (!days) return;
  try {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const { count } = await prisma.liveResult.updateMany({
      where: { createdAt: { lt: cutoff }, NOT: { transcriptJson: PRUNED } },
      data: { transcriptJson: PRUNED, judgeJson: null },
    });
    if (count > 0) log.info("retention", "pruned transcripts", { count, days });
  } catch (err) {
    log.warn("retention", "prune failed", { err: String(err) });
  }
}
