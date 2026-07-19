import { describe, expect, it } from "vitest";
import { CALIBRATION_CASES } from "@/lib/fixtures/calibration";
import { mockProvider } from "./mock-provider";
import type { Provider } from "./provider";

/**
 * Judge calibration — `npm run calibrate`.
 *
 * Replays the hand-labeled transcript set through the configured judge
 * and prints agreement + a confusion matrix. With no key (or
 * PREFLIGHT_LLM_KEY=mock) it exercises the deterministic mock judge —
 * useful as a harness smoke test, not a quality claim. With a real key
 * and CALIBRATE=real it measures the production judge; that number is
 * the one to publish.
 */

async function judgeAll(provider: Provider) {
  const rows: { id: string; human: string; judge: string; agree: boolean }[] = [];
  for (const c of CALIBRATION_CASES) {
    const result = await provider.judge(c.scenario, c.steps);
    const got = result.verdict.outcome;
    rows.push({ id: c.id, human: c.humanLabel, judge: got, agree: got === c.humanLabel });
  }
  return rows;
}

function report(rows: { id: string; human: string; judge: string; agree: boolean }[]) {
  const labels = ["pass", "fail", "partial"] as const;
  const matrix: Record<string, Record<string, number>> = {};
  for (const h of labels) {
    matrix[h] = { pass: 0, fail: 0, partial: 0, error: 0 };
  }
  for (const r of rows) matrix[r.human][r.judge] = (matrix[r.human][r.judge] ?? 0) + 1;

  const agreement = rows.filter((r) => r.agree).length / rows.length;
  const lines = [
    "",
    `Judge calibration — ${rows.length} hand-labeled cases`,
    `Agreement: ${(agreement * 100).toFixed(1)}%`,
    "",
    "               judge→   pass   fail   partial",
    ...labels.map(
      (h) =>
        `  human ${h.padEnd(8)}     ${String(matrix[h].pass).padStart(4)}   ${String(
          matrix[h].fail,
        ).padStart(4)}   ${String(matrix[h].partial).padStart(6)}`,
    ),
    "",
    "Disagreements:",
    ...rows.filter((r) => !r.agree).map((r) => `  ${r.id}: human=${r.human} judge=${r.judge}`),
    "",
  ];
  // stdout directly — vitest's console interception would swallow the
  // report, and the report IS the product of `npm run calibrate`.
  process.stdout.write(lines.join("\n") + "\n");
  return agreement;
}

describe("judge calibration", () => {
  it("replays every case through the judge and reports agreement", async () => {
    const useReal = process.env.CALIBRATE === "real";
    const provider = useReal
      ? (await import("./provider")).getProvider !== undefined
        ? await (await import("./provider")).getProvider()
        : null
      : mockProvider;
    if (!provider) {
      throw new Error("CALIBRATE=real requires PREFLIGHT_LLM_KEY / ANTHROPIC_API_KEY.");
    }

    const rows = await judgeAll(provider);
    const agreement = report(rows);

    // Every case must produce a verdict; agreement itself is a report,
    // not an assertion — except that the judge must beat coin-flipping
    // on this set, which even the heuristic mock clears.
    expect(rows).toHaveLength(CALIBRATION_CASES.length);
    expect(agreement).toBeGreaterThan(1 / 3);
  }, 300_000);
});
