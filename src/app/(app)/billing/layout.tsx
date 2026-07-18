import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing & usage — Preflight",
  description: "Plan, token balance, and real usage metering.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
