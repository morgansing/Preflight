import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Gauntlet",
  description:
    "Rerun Preflight's 23 hardest AI-agent scenarios, expose failures under pressure, and carry the replay evidence into your release decision.",
  openGraph: {
    title: "The Gauntlet — Preflight",
    description:
      "No warm-up. Just 23 difficulty 4–5 scenarios, 16 hidden prompt-injection attacks, and replayable evidence for the release decision.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Gauntlet — Preflight",
    description:
      "The rerunnable hard slice for AI agents: 23 difficult decisions with the evidence attached.",
  },
};

export default function GauntletLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
