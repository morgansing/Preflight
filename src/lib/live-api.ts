"use client";

import type {
  LiveEvent,
  LiveReplayPayload,
  LiveRunListItem,
  LiveRunSummary,
} from "./live-types";

export async function fetchProviderStatus(): Promise<"anthropic" | "mock" | null> {
  const res = await fetch("/api/live/status");
  if (!res.ok) return null;
  return (await res.json()).provider;
}

export async function fetchRuns(): Promise<LiveRunListItem[]> {
  const res = await fetch("/api/live/runs");
  if (!res.ok) return [];
  return res.json();
}

export async function fetchRun(id: string): Promise<LiveRunSummary | null> {
  const res = await fetch(`/api/live/runs/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function startRun(body: {
  agentName: string;
  agentKind: string;
  endpoint?: string;
  suite: string; // tier id, e.g. smoke | standard | extended | scale | exhaustive | max
}): Promise<{ runId: string } | { error: string }> {
  const res = await fetch("/api/live/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return res.ok ? json : { error: json.error ?? `HTTP ${res.status}` };
}

export async function fetchLiveReplay(
  runId: string,
  scenarioId: string,
): Promise<LiveReplayPayload | null> {
  const res = await fetch(`/api/live/results/${runId}/${scenarioId}`);
  if (!res.ok) return null;
  return res.json();
}

/** Subscribe to a run's SSE stream. Returns a cleanup function. */
export function subscribeRun(runId: string, onEvent: (e: LiveEvent) => void): () => void {
  const source = new EventSource(`/api/live/runs/${runId}/events`);
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      /* ignore malformed frames */
    }
  };
  return () => source.close();
}
