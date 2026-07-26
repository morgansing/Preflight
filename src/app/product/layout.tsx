import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Turn your operating rules into simulations, replay every failure, and gate AI-agent releases with evidence.",
};

export default function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
