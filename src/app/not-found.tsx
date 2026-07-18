import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-24 text-center">
      <div className="eyebrow">404</div>
      <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
        Nothing at this address
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-sub">
        The page may have moved — everything in the workspace is reachable from the
        dashboard, or ⌘K from anywhere.
      </p>
      <div className="mt-8">
        <Link
          href="/dashboard"
          className="focus-ring inline-flex h-10 items-center rounded-lg border border-edge px-4 text-sm font-medium text-ink transition-all hover:border-mut hover:bg-raised"
        >
          ← Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
