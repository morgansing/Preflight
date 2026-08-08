"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAppGuide } from "@/components/app-guide";
import { openPalette } from "@/components/command-palette";
import { useMode } from "@/lib/mode";
import { useSession } from "@/lib/auth";
import { planById } from "@/lib/billing";
import styles from "./nav-rail.module.css";

/* The product's existing hairline icon language, kept deliberately restrained. */
const icons = {
  dashboard: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <rect x="2.5" y="4.5" width="11" height="8" rx="2" />
      <path d="M8 4.5V2M5.5 8.5h.01M10.5 8.5h.01M6 11h4" strokeLinecap="round" />
    </svg>
  ),
  scenarios: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M3 3.5h10M3 8h10M3 12.5h6" strokeLinecap="round" />
    </svg>
  ),
  runs: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.75 5.75l3.5 2.25-3.5 2.25z" fill="currentColor" stroke="none" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M4 1.5h6l3 3V14a.5.5 0 01-.5.5h-8.5A.5.5 0 013.5 14V2a.5.5 0 01.5-.5z" />
      <path d="M6 9h4M6 11.5h2.5" strokeLinecap="round" />
    </svg>
  ),
  benchmark: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M3 13.5V8M8 13.5V4M13 13.5V6.5" strokeLinecap="round" />
    </svg>
  ),
  setup: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M2.5 5h11M2.5 11h11" strokeLinecap="round" />
      <circle cx="6" cy="5" r="1.75" fill="var(--color-surface)" />
      <circle cx="10.5" cy="11" r="1.75" fill="var(--color-surface)" />
    </svg>
  ),
};

const groups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: icons.dashboard },
      { href: "/setup", label: "Setup", icon: icons.setup },
      { href: "/agents", label: "Agents", icon: icons.agents },
      { href: "/scenarios", label: "Scenarios", icon: icons.scenarios },
    ],
  },
  {
    label: "Evidence",
    items: [
      { href: "/runs", label: "Runs", icon: icons.runs },
      { href: "/reports", label: "Reports", icon: icons.reports },
      { href: "/benchmark", label: "Benchmark", icon: icons.benchmark },
    ],
  },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavRail() {
  const pathname = usePathname();
  const { mode, setMode } = useMode();
  const { session } = useSession();
  const { open: guideOpen, showGuide } = useAppGuide();
  const accountActive = pathname.startsWith("/billing");
  const navGroupsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const navGroups = navGroupsRef.current;
    if (!navGroups) return;

    let updateFrame = 0;
    const updateOverflow = () => {
      cancelAnimationFrame(updateFrame);
      updateFrame = requestAnimationFrame(() => {
        const maxScroll = navGroups.scrollWidth - navGroups.clientWidth;
        navGroups.dataset.overflowLeft = String(navGroups.scrollLeft > 2);
        navGroups.dataset.overflowRight = String(navGroups.scrollLeft < maxScroll - 2);
      });
    };

    const revealActiveRoute = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) {
        updateOverflow();
        return;
      }
      navGroups
        .querySelector<HTMLElement>('[aria-current="page"]')
        ?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
      updateOverflow();
    };

    revealActiveRoute();
    navGroups.addEventListener("scroll", updateOverflow, { passive: true });
    const resizeObserver = new ResizeObserver(revealActiveRoute);
    resizeObserver.observe(navGroups);

    return () => {
      cancelAnimationFrame(updateFrame);
      navGroups.removeEventListener("scroll", updateOverflow);
      resizeObserver.disconnect();
    };
  }, [pathname]);

  return (
    <nav className={`no-print ${styles.rail}`} aria-label="Application navigation">
      <Link href="/" className={styles.brand} aria-label="Preflight home">
        <span className={styles.brandSignal} aria-hidden="true" />
        <span className={styles.brandText}>PREFLIGHT</span>
        <span className={styles.brandMeta} aria-hidden="true">CONTROL</span>
      </Link>

      <button
        type="button"
        onClick={openPalette}
        className={styles.searchButton}
        aria-label="Open command palette"
        title="Search Preflight (Ctrl K)"
      >
        <span className={styles.searchIcon} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
        </span>
        <span className={styles.searchText}>Search Preflight</span>
        <kbd className={styles.shortcut}>CTRL K</kbd>
      </button>

      <div className={styles.navGroups} ref={navGroupsRef}>
        {groups.map((group, groupIndex) => {
          const groupId = `nav-group-${groupIndex}`;
          return (
            <section className={styles.navGroup} aria-labelledby={groupId} key={group.label}>
              <p className={styles.groupLabel} id={groupId}>{group.label}</p>
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`${styles.navLink} ${active ? styles.active : ""}`}
                        aria-current={active ? "page" : undefined}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <span className={styles.iconWrap}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                        {active && <span className={styles.activeDot} aria-hidden="true" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className={styles.guideArea}>
        <button
          type="button"
          className={styles.guideButton}
          onClick={(event) => showGuide(event.currentTarget)}
          aria-label="How Preflight works"
          aria-haspopup="dialog"
          aria-expanded={guideOpen}
          aria-controls="preflight-guide"
          title="How Preflight works"
        >
          <span className={styles.guideIcon} aria-hidden="true">?</span>
          <span className={styles.guideCopy}>
            <strong>How it works</strong>
            <small>Five-step field guide</small>
          </span>
          <span className={styles.guideArrow} aria-hidden="true">↗</span>
        </button>
      </div>

      <div className={styles.railFooter}>
        <div className={styles.accountArea}>
          {session ? (
            <Link
              href="/billing"
              className={`${styles.account} ${accountActive ? styles.accountActive : ""}`}
              aria-current={accountActive ? "page" : undefined}
              aria-label={`${session.name}, billing and usage`}
              title={`${session.name} - Billing & usage`}
            >
              <span className={styles.avatar} aria-hidden="true">
                {session.name.trim().charAt(0).toUpperCase() || "P"}
              </span>
              <span className={styles.accountCopy}>
                <span className={styles.accountName}>{session.name}</span>
                <span className={styles.accountDetail}>Billing &amp; usage</span>
              </span>
              <span className={styles.planBadge}>{planById(session.plan).name.toUpperCase()}</span>
            </Link>
          ) : (
            <Link
              href="/signup"
              className={styles.account}
              aria-label="Create a Preflight workspace"
              title="Create workspace - 250 scenarios free"
            >
              <span className={styles.avatar} aria-hidden="true">+</span>
              <span className={styles.accountCopy}>
                <span className={styles.accountName}>Create workspace</span>
                <span className={styles.accountDetail}>250 scenarios free</span>
              </span>
              <span className={styles.planBadge}>FREE</span>
            </Link>
          )}
        </div>

        <div className={styles.modeArea}>
          <button
            type="button"
            onClick={() => setMode(mode === "demo" ? "live" : "demo")}
            className={styles.modeButton}
            aria-pressed={mode === "live"}
            aria-label={`${mode === "demo" ? "Demo" : "Live"} mode. Switch to ${mode === "demo" ? "live" : "demo"} mode`}
            title={`Switch to ${mode === "demo" ? "Live" : "Demo"} mode`}
          >
            <span className={`${styles.modeIndicator} ${mode === "live" ? styles.modeLive : ""}`}>
              <span className={styles.modeDot} aria-hidden="true" />
              <span className={styles.modeWord}>{mode.toUpperCase()}</span>
            </span>
            <span className={styles.modeCopy}>switch environment</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
