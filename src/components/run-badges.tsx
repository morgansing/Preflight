/* Small shared identity marks for runs — the Gauntlet's emblem, the
 * mock-provider badge, and flight-plan naming. */

/** The Gauntlet's emblem — an amber bolt with a soft glow, so the hard
 * slice reads at a glance everywhere it appears. */
export function GauntletMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-warn/60 bg-warn/15 text-warn shadow-[0_0_10px_rgba(224,163,64,0.45)] ${className}`}
    >
      <svg viewBox="0 0 12 12" className="size-3" fill="currentColor">
        <path d="M6.9.7 2.1 7h2.7l-1 4.3L9.9 5H7.1l1-4.3z" />
      </svg>
    </span>
  );
}

/** Human name for a flight-plan kind. */
export function planKindLabel(kind: string): string {
  return kind === "quick"
    ? "Quick check"
    : kind === "deep"
      ? "Deep validation"
      : kind === "signoff"
        ? "Production sign-off"
        : "Flight plan";
}

export function MockBadge() {
  return (
    <span
      title="PREFLIGHT_LLM_KEY=mock — deterministic mock provider for development. Not a real evaluation."
      className="inline-flex h-6 items-center rounded-md border border-warn/50 bg-warn/10 px-2 font-mono text-[10px] tracking-[0.14em] text-warn"
    >
      MOCK PROVIDER
    </span>
  );
}
