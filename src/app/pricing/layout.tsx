import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Monthly simulation pricing for AI-agent evaluation, with a free one-time allowance, clear run limits, and non-expiring credit packs.",
  openGraph: {
    title: "Pricing — Preflight",
    description:
      "Pay for evaluated simulations, not seats. Compare monthly allowances, suite limits, and Standard-run equivalents.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — Preflight",
    description:
      "Pay for evaluated simulations, not seats. Clear monthly allowances and no hidden annual commitment.",
  },
};

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
