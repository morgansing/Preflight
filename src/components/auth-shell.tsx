"use client";

import Link from "next/link";

/**
 * Split-screen shell for /signup and /login. The left panel sells the
 * product's one moment — the report where your agent fails — because
 * that's what the person arriving here was promised. Right panel is
 * the form, handed in as children.
 */

// A deterministic mini-wall: the 22%-ready run in miniature. Painted
// from a fixed pattern (never random) so server and client agree.
const WALL = "xxpxfxxfpxfxxxpfxfxxfxpxxfxfpxxfxxfpxfxx".split("");
const cellTint: Record<string, string> = {
  p: "bg-accent/60",
  x: "bg-fail/50",
  f: "bg-warn/50",
};

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-edge bg-surface p-10 lg:flex">
        <Link href="/" className="focus-ring flex w-fit items-center gap-2 rounded-md">
          <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
          <span className="font-mono text-xs tracking-[0.18em] text-ink">PREFLIGHT</span>
        </Link>

        <div className="max-w-md">
          <h2 className="font-display text-4xl leading-[1.15] tracking-tight text-ink">
            Find out your agent isn&apos;t ready before your customers do.
          </h2>

          {/* The wow-moment report, in miniature. */}
          <div className="mt-10 rounded-xl border border-edge bg-raised/60 p-6">
            <div className="eyebrow">A first run, typically</div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-5xl text-ink">
                22<span className="text-2xl text-sub">%</span>
              </span>
              <span className="text-sm text-sub">ready</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] tabular-nums">
              <span className="text-fail">28 failures</span>
              <span className="text-fail">5 critical risks</span>
              <span className="text-warn">2 off-policy</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-1">
              {WALL.map((c, i) => (
                <span key={i} className={`size-2.5 rounded-[2px] ${cellTint[c]}`} />
              ))}
            </div>
            <p className="mt-5 border-t border-edge pt-4 text-[13px] leading-relaxed text-sub">
              Every red cell is a replay: the exact turn where the agent gave in,
              refunded, or promised what it shouldn&apos;t. Fix it, rerun, ship.
            </p>
          </div>
        </div>

        <p className="font-mono text-[11px] tracking-wide text-mut">
          The flight simulator for AI agents
        </p>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="focus-ring mb-10 flex w-fit items-center gap-2 rounded-md lg:hidden">
            <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
            <span className="font-mono text-xs tracking-[0.18em] text-ink">PREFLIGHT</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
