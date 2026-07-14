import type { LiveEvent } from "@/lib/live-types";

/**
 * In-process event bus for streaming run results into Mission Control.
 * The DB is the source of truth (SSE consumers catch up from it on
 * connect); the bus only carries the live tail. Stored on globalThis so
 * Next dev hot-reload doesn't orphan subscribers.
 */

type Listener = (event: LiveEvent) => void;

const globalForBus = globalThis as unknown as {
  __preflightBus?: Map<string, Set<Listener>>;
};

const bus = (globalForBus.__preflightBus ??= new Map<string, Set<Listener>>());

export function emit(runId: string, event: LiveEvent): void {
  for (const listener of bus.get(runId) ?? []) {
    try {
      listener(event);
    } catch {
      // a broken SSE consumer must not break the run
    }
  }
  if (event.type === "run_finished") {
    // Give late consumers a beat, then drop the channel.
    setTimeout(() => bus.delete(runId), 30_000).unref?.();
  }
}

export function subscribe(runId: string, listener: Listener): () => void {
  let set = bus.get(runId);
  if (!set) {
    set = new Set();
    bus.set(runId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) bus.delete(runId);
  };
}
