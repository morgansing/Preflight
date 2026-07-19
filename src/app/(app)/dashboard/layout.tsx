import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Preflight",
  description: "Agents under test and how close each is to shipping.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
