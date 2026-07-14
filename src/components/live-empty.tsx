"use client";

import { ButtonLink, EmptyState } from "./ui";

/**
 * Live mode never falls back to scripted data. With no agent connected
 * and no key set, every surface shows this calm state instead.
 */
export function LiveEmpty({ surface }: { surface: string }) {
  return (
    <div className="mx-auto max-w-2xl px-8 py-24">
      <EmptyState
        icon={
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            className="size-8"
          >
            <path d="M16 3l3.5 7 7.5 1-5.5 5.5L23 24l-7-3.5L9 24l1.5-7.5L5 11l7.5-1z" strokeLinejoin="round" />
          </svg>
        }
        title="Live mode runs your agent for real."
        body={`Connect an agent or use the built-in reference agent to begin. Once a live run lands, ${surface} reads from real transcripts — never from scripted data.`}
        action={<ButtonLink href="/agents/connect">Connect an agent</ButtonLink>}
      />
    </div>
  );
}
