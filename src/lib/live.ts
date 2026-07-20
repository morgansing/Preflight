"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { authHeaders } from "./supabase";

/**
 * Live-mode agent registry — server-backed, so the list follows the
 * signed-in user across devices. The outbound bearer token never
 * leaves this browser: it lives in a localStorage vault keyed by agent
 * id and is merged into the server rows on read. Registrations that
 * predate the server registry are migrated up once, transparently.
 */

export type ConnectionKind = "http" | "openai" | "mcp" | "reference";

export interface RegisteredAgent {
  id: string;
  name: string;
  kind: ConnectionKind;
  endpoint?: string;
  /** OpenAI-compatible: model name to request. */
  model?: string;
  /** Outbound bearer token sent to the agent endpoint — browser-local
   * vault only, never persisted server-side. */
  authToken?: string;
  /** OpenAI-compatible: the agent's system prompt. */
  systemPrompt?: string;
  createdAt: string;
}

const LEGACY_KEY = "preflight.live.agents";
const VAULT_KEY = "preflight.live.tokens";
const EMPTY: RegisteredAgent[] = [];
const listeners = new Set<() => void>();

let cache: RegisteredAgent[] = EMPTY;
let loaded = false;
let loading = false;

function emit() {
  for (const l of listeners) l();
}

function vault(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(VAULT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveVault(v: Record<string, string>) {
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(v));
}

function withTokens(agents: RegisteredAgent[]): RegisteredAgent[] {
  const v = vault();
  return agents.map((a) => (v[a.id] ? { ...a, authToken: v[a.id] } : a));
}

async function refresh(): Promise<void> {
  if (loading) return;
  loading = true;
  try {
    const res = await fetch("/api/live/agents", { headers: await authHeaders() });
    if (!res.ok) return;
    let list = (await res.json()) as RegisteredAgent[];

    // One-time migration: registrations from the localStorage era move
    // to the server (tokens stay behind, in the vault).
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as RegisteredAgent[];
        const known = new Set(list.map((a) => a.id));
        const v = vault();
        for (const a of legacy.reverse()) {
          if (known.has(a.id)) continue;
          if (a.authToken) v[a.id] = a.authToken;
          await fetch("/api/live/agents", {
            method: "POST",
            headers: { "content-type": "application/json", ...(await authHeaders()) },
            body: JSON.stringify({
              id: a.id,
              name: a.name,
              kind: a.kind,
              endpoint: a.endpoint,
              model: a.model,
              systemPrompt: a.systemPrompt,
            }),
          });
        }
        saveVault(v);
        window.localStorage.removeItem(LEGACY_KEY);
        const again = await fetch("/api/live/agents", { headers: await authHeaders() });
        if (again.ok) list = (await again.json()) as RegisteredAgent[];
      } catch {
        /* migration is best-effort; the legacy list stays for next load */
      }
    }

    cache = withTokens(list);
    loaded = true;
    emit();
  } catch {
    /* offline — keep whatever we have */
  } finally {
    loading = false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) void refresh();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RegisteredAgent[] {
  return cache;
}

function getServerSnapshot(): RegisteredAgent[] {
  return EMPTY;
}

export function useLiveAgents() {
  const agents = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // A sign-in after mount changes whose list this is — reload once.
  useEffect(() => {
    if (!loaded) void refresh();
  }, []);

  const register = useCallback((a: Omit<RegisteredAgent, "id" | "createdAt">) => {
    const agent: RegisteredAgent = {
      ...a,
      id: `agt_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    if (agent.authToken) {
      const v = vault();
      v[agent.id] = agent.authToken;
      saveVault(v);
    }
    // Optimistic: the launcher sees it immediately; the server write
    // follows (token excluded).
    cache = [agent, ...cache];
    emit();
    void (async () => {
      await fetch("/api/live/agents", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          id: agent.id,
          name: agent.name,
          kind: agent.kind,
          endpoint: agent.endpoint,
          model: agent.model,
          systemPrompt: agent.systemPrompt,
        }),
      }).catch(() => {});
    })();
    return agent;
  }, []);

  const remove = useCallback((id: string) => {
    cache = cache.filter((a) => a.id !== id);
    const v = vault();
    delete v[id];
    saveVault(v);
    emit();
    void (async () => {
      await fetch(`/api/live/agents/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      }).catch(() => {});
    })();
  }, []);

  return { agents, register, remove };
}
