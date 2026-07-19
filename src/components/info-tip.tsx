"use client";

import { useState } from "react";

/**
 * A small "i" button that reveals an explainer on hover, focus, or tap.
 * For the places where a label can't carry the whole mental model —
 * keep the popover to a few short lines.
 */
export function InfoTip({
  label = "What does this mean?",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="focus-ring flex size-4 cursor-help items-center justify-center rounded-full border border-edge font-mono text-[9px] leading-none text-mut transition-colors hover:border-mut hover:text-sub"
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="animate-fade-in absolute left-1/2 top-6 z-30 w-80 -translate-x-1/2 rounded-lg border border-edge bg-raised p-4 text-left shadow-2xl"
        >
          {children}
        </div>
      )}
    </span>
  );
}
