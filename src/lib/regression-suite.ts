"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Scenario } from "./types";

export interface RegressionSuiteEntry {
  scenarioId: string;
  name: string;
  severity: Scenario["severity"];
  addedAt: string;
  sourceRunId?: string;
}

const KEY = "preflight.regression-suite";
const EMPTY: RegressionSuiteEntry[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheParsed: RegressionSuiteEntry[] = EMPTY;

function emit() {
  cacheRaw = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): RegressionSuiteEntry[] {
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (raw === cacheRaw) return cacheParsed;
  cacheRaw = raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    cacheParsed = Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is RegressionSuiteEntry =>
            !!entry &&
            typeof entry === "object" &&
            typeof (entry as RegressionSuiteEntry).scenarioId === "string" &&
            typeof (entry as RegressionSuiteEntry).name === "string" &&
            typeof (entry as RegressionSuiteEntry).addedAt === "string",
        )
      : EMPTY;
  } catch {
    cacheParsed = EMPTY;
  }
  return cacheParsed;
}

function getServerSnapshot(): RegressionSuiteEntry[] {
  return EMPTY;
}

export function useRegressionSuite() {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((scenario: Scenario, sourceRunId?: string) => {
    const next: RegressionSuiteEntry = {
      scenarioId: scenario.id,
      name: scenario.name,
      severity: scenario.severity,
      addedAt: new Date().toISOString(),
      sourceRunId,
    };
    const withoutDuplicate = getSnapshot().filter(
      (entry) => entry.scenarioId !== scenario.id,
    );
    window.localStorage.setItem(KEY, JSON.stringify([next, ...withoutDuplicate]));
    emit();
  }, []);

  const remove = useCallback((scenarioId: string) => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(getSnapshot().filter((entry) => entry.scenarioId !== scenarioId)),
    );
    emit();
  }, []);

  return {
    entries,
    scenarioIds: entries.map((entry) => entry.scenarioId),
    has: (scenarioId: string) => entries.some((entry) => entry.scenarioId === scenarioId),
    add,
    remove,
  };
}
