import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Readiness report — Preflight",
  description: "The document a champion forwards to their boss.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
