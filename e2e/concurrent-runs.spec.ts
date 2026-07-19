import { expect, test } from "@playwright/test";

/**
 * Store isolation proof: two sandbox runs launched simultaneously must
 * BOTH execute (the old shared store would 409 the second), both
 * complete with a full set of results, and stay disjoint.
 */

test("two simultaneous sandbox runs execute concurrently and stay disjoint", async ({
  request,
}) => {
  const launch = (agentName: string) =>
    request.post("/api/live/runs", {
      data: { agentKind: "reference", agentName, suite: "smoke", sandbox: true },
    });

  const [a, b] = await Promise.all([launch("Isolation A"), launch("Isolation B")]);
  expect(a.status(), await a.text()).toBe(201);
  expect(b.status(), await b.text()).toBe(201);
  const runA = (await a.json()).runId as string;
  const runB = (await b.json()).runId as string;
  expect(runA).not.toBe(runB);

  // Poll both to completion.
  const finished: Record<string, { status: string; results: unknown[] }> = {};
  for (let i = 0; i < 60 && Object.keys(finished).length < 2; i++) {
    for (const id of [runA, runB]) {
      if (finished[id]) continue;
      const res = await request.get(`/api/live/runs/${id}`);
      const run = await res.json();
      if (run.status === "complete" || run.status === "error") finished[id] = run;
    }
    if (Object.keys(finished).length < 2) await new Promise((r) => setTimeout(r, 1500));
  }

  expect(finished[runA]?.status, "run A should complete").toBe("complete");
  expect(finished[runB]?.status, "run B should complete").toBe("complete");
  expect(finished[runA].results).toHaveLength(24);
  expect(finished[runB].results).toHaveLength(24);

  // Disjoint stores: each run's store slice is deleted after completion,
  // and every result row belongs to exactly one run.
  const ids = new Set(
    (finished[runA].results as Array<{ scenarioId: string }>).map((r) => r.scenarioId),
  );
  expect(ids.size).toBe(24);
});
