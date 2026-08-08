import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { getSiteUrl } from "./seo";
import "./globals.css";

// Editorial display serif — stands in for Canela. Self-hosted at build
// time by next/font, so the demo never fetches fonts at runtime.
const canela = Fraunces({
  variable: "--font-canela",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Preflight",
  url: siteUrl.toString(),
  description:
    "Stress-test AI agents across realistic scenarios, inspect every decision, and ship with evidence instead of hope.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Preflight — The flight simulator for AI agents",
    template: "%s | Preflight",
  },
  description:
    "Stress-test AI agents across realistic scenarios, inspect every decision, and ship with evidence instead of hope.",
  openGraph: {
    type: "website",
    title: "Know how your agent fails before your users do.",
    description:
      "The flight simulator for AI agents. Stress-test behavior, replay every decision, and turn failures into regression tests.",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Preflight agent replay showing what an agent saw, did, and should have done",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Know how your agent fails before your users do.",
    description:
      "Stress-test AI agents, replay every decision, and ship with evidence.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${canela.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationJsonLd).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
        {children}
      </body>
    </html>
  );
}
