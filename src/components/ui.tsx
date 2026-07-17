import Link from "next/link";
import { DIFFICULTY_LABELS, type Difficulty, type Severity } from "@/lib/types";
import type { LiveOutcome } from "@/lib/live-types";

/* Base components. Every one of these leans on the Part 2 rules:
 * hairline borders, 8px-scale spacing, one accent, calm motion. */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98] " +
  "disabled:opacity-40 disabled:pointer-events-none select-none cursor-pointer";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-[#08110b] hover:bg-[#54e294]",
  secondary: "border border-edge text-ink hover:border-mut hover:bg-raised",
  ghost: "text-sub hover:text-ink hover:bg-raised",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({
  raised = false,
  className = "",
  children,
}: {
  raised?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-edge p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${
        raised ? "bg-raised" : "bg-surface"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* Status language: colour never carries meaning alone — every outcome
 * pairs a dot with a glyph or label. Red means failure and nothing else. */

export const outcomeColor: Record<LiveOutcome, string> = {
  pass: "var(--color-accent)",
  fail: "var(--color-fail)",
  partial: "var(--color-warn)",
  // Infra failure, not agent failure — amber on purpose, never red.
  error: "var(--color-warn)",
};

export const outcomeGlyph: Record<LiveOutcome, string> = {
  pass: "✓",
  fail: "✗",
  partial: "◐",
  error: "!",
};

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-1.5 rounded-full ${className}`}
      style={{ background: color }}
    />
  );
}

export function OutcomeChip({ outcome }: { outcome: LiveOutcome }) {
  const labels: Record<LiveOutcome, string> = {
    pass: "Pass",
    fail: "Fail",
    partial: "Partial",
    error: "Run error",
  };
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] uppercase tracking-wider"
      style={{
        color: outcomeColor[outcome],
        borderColor: `color-mix(in srgb, ${outcomeColor[outcome]} 35%, transparent)`,
        background: `color-mix(in srgb, ${outcomeColor[outcome]} 8%, transparent)`,
      }}
    >
      <span aria-hidden>{outcomeGlyph[outcome]}</span>
      {labels[outcome]}
    </span>
  );
}

export function SeverityLabel({ severity }: { severity: Severity }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-wider text-sub">
      {severity}
    </span>
  );
}

/** Difficulty 1–5 as a five-tick meter plus its name — always both, so
 * the ticks never carry the meaning alone. */
export function DifficultyLabel({ level }: { level: Difficulty }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Difficulty ${level}/5 — ${DIFFICULTY_LABELS[level]}`}
    >
      <span aria-hidden className="flex items-center gap-[3px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2 w-1 rounded-[1px] ${i <= level ? "bg-sub" : "bg-edge"}`}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-wider text-sub">
        {DIFFICULTY_LABELS[level]}
      </span>
    </span>
  );
}

export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-raised ${className}`}
      aria-hidden
    />
  );
}

/** Empty state: tasteful icon, concise explanation, one clear action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="animate-fade-up flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-edge px-8 py-16 text-center">
      <div className="text-mut">{icon}</div>
      <div className="max-w-sm space-y-2">
        <div className="text-[15px] font-medium text-ink">{title}</div>
        <p className="text-sm leading-relaxed text-sub">{body}</p>
      </div>
      {action}
    </div>
  );
}
