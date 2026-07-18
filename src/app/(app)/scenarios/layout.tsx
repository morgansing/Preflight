import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scenarios — Preflight",
  description: "The scenario library — graded by difficulty, filterable by category.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
