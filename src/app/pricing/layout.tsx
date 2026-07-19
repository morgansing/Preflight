import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Preflight",
  description: "Free 250 simulations; plans that meter simulations, not seats.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
