import { AppGuideProvider } from "@/components/app-guide";
import { CommandPalette } from "@/components/command-palette";
import { MobileNav, NavRail } from "@/components/nav-rail";
import styles from "./app-shell.module.css";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Below lg the rail hides and MobileNav's top bar takes over; the
  // shell stays a flex row on desktop once the rail is visible.
  return (
    <AppGuideProvider>
      <div className={styles.shell}>
        <a className={styles.skipLink} href="#app-content">
          Skip to app content
        </a>
        <div className={styles.ambient} aria-hidden="true" />
        <NavRail />
        <MobileNav />
        <main id="app-content" className={styles.main} tabIndex={-1}>
          <div className={styles.content}>{children}</div>
        </main>
        <CommandPalette />
      </div>
    </AppGuideProvider>
  );
}
