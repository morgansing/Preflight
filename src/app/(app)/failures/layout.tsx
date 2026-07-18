import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Failures — Preflight",
  description: "Every open miss across the fleet, in one triage list.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
