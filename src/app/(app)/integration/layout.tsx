import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integration guide — Preflight",
  description: "Connect your agent and gate your CI on readiness.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
