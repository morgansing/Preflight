"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary — an unhandled client throw used to be a
 * blank screen. Styled like the app's not-found states.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[preflight] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-24 text-center">
      <div className="eyebrow">Something broke</div>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
        This screen hit an error
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-sub">
        The rest of Preflight is fine — try again, or head back to the dashboard.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="focus-ring inline-flex h-10 cursor-pointer items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="focus-ring inline-flex h-10 items-center rounded-lg border border-edge px-4 text-sm font-medium text-ink transition-all hover:border-mut hover:bg-raised"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
