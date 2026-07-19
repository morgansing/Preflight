import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Preflight",
  description: "Sign in to your Preflight workspace.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
