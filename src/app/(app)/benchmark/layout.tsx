import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Benchmark — Preflight",
  description: "Two runs on the same suite, diffed.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
