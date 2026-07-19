/**
 * Re-mounts on every route change inside the app shell, giving each
 * page a calm 350ms fade-in. Opacity only — no transform — so sticky
 * headers and the fixed nav are unaffected; the global reduced-motion
 * rule collapses it to instant.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
