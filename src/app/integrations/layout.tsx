import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Connect an OpenAI-compatible agent or a custom HTTP endpoint to Preflight's simulated evaluation environment.",
};

export default function IntegrationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
