import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Gauntlet",
  description:
    "Smoke includes 7 of Preflight's 23 Gauntlet cases. Every 200+ coverage tier includes all 23, while focused reruns isolate the highest-risk decisions after each fix.",
  openGraph: {
    title: "The Gauntlet — Preflight",
    description:
      "Smoke runs 24 scenarios and includes 7 of the 23 Gauntlet cases. Every 200+ coverage tier includes all 23. Focused Gauntlet reruns isolate the hard slice.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Gauntlet — Preflight",
    description:
      "Smoke samples 7 of 23. Every 200+ tier covers all 23. Focused Gauntlet reruns isolate the highest-risk AI-agent decisions.",
  },
};

export default function GauntletLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
