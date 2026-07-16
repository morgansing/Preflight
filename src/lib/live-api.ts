"use client";

import type {
  ClusterReport,
  LiveEvent,
  LiveReplayPayload,
  LiveRunListItem,
  LiveRunSummary,
  RegressionReport,
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
  /** OpenAI-compatible: model to request. */
  model?: string;
  /** Outbound bearer token sent to the agent endpoint. */
  authToken?: string;
  /** OpenAI-compatible: the agent's system prompt. */
  systemPrompt?: string;
  suite: string; // tier id, e.g. smoke | standard | ... | security | custom:<v>
  /** Current plan — free runs are metered against the free grant. */
  plan?: string;
  /** Workspace identity for free-grant enforcement. */
  identity?: { email?: string; fingerprint?: string };
}): Promise<{ runId: string } | { error: string; freeGrantBlocked?: boolean }> {
  const res = await fetch("/api/live/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return res.ok
    ? json
    : { error: json.error ?? `HTTP ${res.status}`, freeGrantBlocked: json.freeGrantBlocked };
}

export interface FreeAllowance {
  allowance: number;
  used: number;
  remaining: number;
  blocked: boolean;
}

/** Server-truth free-grant balance for an identity (email + fingerprint). */
export async function fetchFreeAllowance(identity: {
  email?: string;
  fingerprint?: string;
}): Promise<FreeAllowance | null> {
  const q = new URLSearchParams();
  if (identity.email) q.set("email", identity.email);
  if (identity.fingerprint) q.set("fp", identity.fingerprint);
  const res = await fetch(`/api/live/free-grant?${q}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchRegression(runId: string): Promise<{
  isBaseline: boolean;
  report: RegressionReport | null;
  reason?: string;
} | null> {
  const res = await fetch(`/api/live/runs/${runId}/regression`);
  if (!res.ok) return null;
  return res.json();
}

/** Pin a completed run as the baseline for its agent + suite. */
export async function pinBaseline(runId: string): Promise<boolean> {
  const res = await fetch("/api/live/baseline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  return res.ok;
}

/** Root-cause clusters for a completed run (null while running/missing). */
export async function fetchClusters(runId: string): Promise<ClusterReport | null> {
  const res = await fetch(`/api/live/runs/${runId}/clusters`);
  if (!res.ok || res.status === 202) return null;
  return res.json();
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
