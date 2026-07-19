import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup — Preflight",
  description: "Extract a rulebook and generate a custom suite.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
