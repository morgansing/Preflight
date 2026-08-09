import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./marketing-shell.module.css";

export type MarketingPage =
  | "home"
  | "product"
  | "gauntlet"
  | "integrations"
  | "pricing";

const primaryLinks: Array<{
  href: string;
  label: string;
  page: MarketingPage;
}> = [
  { href: "/", label: "Home", page: "home" },
  { href: "/product", label: "Product", page: "product" },
  { href: "/gauntlet", label: "Gauntlet", page: "gauntlet" },
  { href: "/integrations", label: "Integrations", page: "integrations" },
  { href: "/pricing", label: "Pricing", page: "pricing" },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="Preflight home">
      <span className={styles.brandSignal} aria-hidden />
      <span>PREFLIGHT</span>
    </Link>
  );
}

export function MarketingHeader({ active }: { active: MarketingPage }) {
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <Brand />
        <nav className={styles.nav} aria-label="Primary navigation">
          {primaryLinks.map((item) => (
            <Link
              key={item.page}
              href={item.href}
              aria-current={active === item.page ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/signup" className={styles.headerCta}>
          Start free <span aria-hidden>{"\u2192"}</span>
        </Link>
      </header>
    </>
  );
}

export function MarketingMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const classes = [styles.mainContent, className].filter(Boolean).join(" ");

  return (
    <main id="main-content" tabIndex={-1} className={classes}>
      <div className={styles.motionField} aria-hidden="true">
        <span className={`${styles.auroraGlow} ${styles.auroraHero}`} />
        <span className={`${styles.auroraGlow} ${styles.auroraLower}`} />
        <span className={`${styles.dataTrace} ${styles.dataTraceHero}`}>
          <span className={styles.tracePacket} />
        </span>
        <span className={`${styles.dataTrace} ${styles.dataTraceMiddle}`}>
          <span className={styles.tracePacket} />
        </span>
        <span className={`${styles.dataTrace} ${styles.dataTraceLower}`} />
      </div>
      {children}
    </main>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <Brand />
      <p>
        TEST BEFORE TRUST {"\u00b7"} {"\u00a9"} 2026
      </p>
      <nav aria-label="Footer navigation">
        {primaryLinks.map((item) => (
          <Link key={item.page} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link href="/runs">Demo</Link>
        <Link href="/login">Sign in</Link>
      </nav>
    </footer>
  );
}
