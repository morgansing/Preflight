import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents — Preflight",
  description: "Agents under test in the workspace.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
