/**
 * Minimal structured server logging. One line per event, a stable
 * scope, and optional context — greppable in any host's log drain.
 * Not a framework; the point is that failures stop being silent.
 */

type Level = "info" | "warn" | "error";

function line(level: Level, scope: string, msg: string, extra?: Record<string, unknown>) {
  const payload = extra ? ` ${JSON.stringify(extra)}` : "";
  const text = `[preflight:${scope}] ${msg}${payload}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const log = {
  info: (scope: string, msg: string, extra?: Record<string, unknown>) =>
    line("info", scope, msg, extra),
  warn: (scope: string, msg: string, extra?: Record<string, unknown>) =>
    line("warn", scope, msg, extra),
  error: (scope: string, msg: string, err?: unknown, extra?: Record<string, unknown>) =>
    line("error", scope, msg, {
      ...extra,
      error: err instanceof Error ? `${err.name}: ${err.message}` : err !== undefined ? String(err) : undefined,
    }),
};

/** Shaped 500 for route handlers: generic to the client, detailed in logs. */
export function routeError(scope: string, err: unknown) {
  log.error(scope, "unhandled route error", err);
  return { error: "Something went wrong on the server — try again." };
}
