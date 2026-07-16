"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMode } from "@/lib/mode";
import { useSession } from "@/lib/auth";
import { planById } from "@/lib/billing";

/* Hand-drawn 16px line icons — no icon library, everything hairline. */
const icons = {
  dashboard: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <rect x="2.5" y="4.5" width="11" height="8" rx="2" />
      <path d="M8 4.5V2M5.5 8.5h.01M10.5 8.5h.01M6 11h4" strokeLinecap="round" />
    </svg>
  ),
  scenarios: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <path d="M3 3.5h10M3 8h10M3 12.5h6" strokeLinecap="round" />
    </svg>
  ),
  runs: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.75 5.75l3.5 2.25-3.5 2.25z" fill="currentColor" stroke="none" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <path d="M4 1.5h6l3 3V14a.5.5 0 01-.5.5h-8.5A.5.5 0 013.5 14V2a.5.5 0 01.5-.5z" />
      <path d="M6 9h4M6 11.5h2.5" strokeLinecap="round" />
    </svg>
  ),
  benchmark: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <path d="M3 13.5V8M8 13.5V4M13 13.5V6.5" strokeLinecap="round" />
    </svg>
  ),
  setup: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-4">
      <path d="M2.5 5h11M2.5 11h11" strokeLinecap="round" />
      <circle cx="6" cy="5" r="1.75" fill="var(--color-surface)" />
      <circle cx="10.5" cy="11" r="1.75" fill="var(--color-surface)" />
    </svg>
  ),
};

const items = [
  { href: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { href: "/setup", label: "Setup", icon: icons.setup },
  { href: "/agents", label: "Agents", icon: icons.agents },
  { href: "/scenarios", label: "Scenarios", icon: icons.scenarios },
  { href: "/runs", label: "Runs", icon: icons.runs },
  { href: "/reports", label: "Reports", icon: icons.reports },
  { href: "/benchmark", label: "Benchmark", icon: icons.benchmark },
];

export function NavRail() {
  const pathname = usePathname();
  const { mode, setMode } = useMode();
  const { session } = useSession();

  return (
    <nav className="no-print sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-edge bg-surface px-3 py-6">
      <Link href="/" className="focus-ring mb-8 flex items-center gap-2 rounded-md px-2">
        <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
        <span className="font-mono text-xs tracking-[0.18em] text-ink">PREFLIGHT</span>
      </Link>

      <div className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] transition-colors duration-150 ${
                active
                  ? "bg-raised text-ink"
                  : "text-sub hover:bg-raised/60 hover:text-ink"
              }`}
            >
              <span className={active ? "text-accent" : "text-mut"}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Account: workspace + plan, or the way in. */}
      <div className="mt-6 border-t border-edge pt-4">
        {session ? (
          <Link
            href="/billing"
            className={`focus-ring flex items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-raised/60 ${
              pathname.startsWith("/billing") ? "bg-raised" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-ink">{session.name}</span>
              <span className="block text-[11px] text-mut">Billing &amp; usage</span>
            </span>
            <span className="shrink-0 rounded border border-edge px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-sub">
              {planById(session.plan).name.toUpperCase()}
            </span>
          </Link>
        ) : (
          <Link
            href="/signup"
            className="focus-ring flex items-center justify-between rounded-lg px-2 py-2 text-[13px] text-sub transition-colors hover:bg-raised/60 hover:text-ink"
          >
            <span>Create workspace</span>
            <span className="font-mono text-[9px] tracking-[0.12em] text-accent">250 FREE</span>
          </Link>
        )}
      </div>

      {/* Mode indicator + switch — subtle but always visible. */}
      <div className="mt-3 border-t border-edge pt-4">
        <button
          onClick={() => setMode(mode === "demo" ? "live" : "demo")}
          className="focus-ring group flex w-full items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-raised/60 cursor-pointer"
          title={`Switch to ${mode === "demo" ? "Live" : "Demo"} mode`}
        >
          {mode === "demo" ? (
            <span className="inline-flex h-6 items-center rounded-md border border-accent/40 px-2 font-mono text-[10px] tracking-[0.14em] text-accent/80">
              DEMO
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-md bg-accent px-2 font-mono text-[10px] tracking-[0.14em] text-[#08110b]">
              LIVE
            </span>
          )}
          <span className="text-[11px] text-mut transition-colors group-hover:text-sub">
            switch
          </span>
        </button>
      </div>
    </nav>
  );
}
