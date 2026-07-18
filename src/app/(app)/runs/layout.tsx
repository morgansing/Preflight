import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Runs — Preflight",
  description: "The run wall, run history, and every past run.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
