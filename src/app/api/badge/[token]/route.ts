import { type NextRequest } from "next/server";
import { badgeData } from "@/server/share";

export const dynamic = "force-dynamic";

/**
 * The Preflight badge — a self-contained SVG shield, embeddable in any
 * README. Public by design; the token is unguessable and read-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const data = await badgeData(token);
  if (!data) {
    return new Response(badgeSvg("preflight", "unknown", "#5c626d"), {
      status: 404,
      headers: svgHeaders(),
    });
  }
  const color = data.score >= 90 ? "#2ea866" : data.score >= 75 ? "#c08a2e" : "#c2453f";
  const value = `${data.score}${data.score >= 90 ? " ✓" : ""}`;
  return new Response(badgeSvg("preflight", value, color), { headers: svgHeaders() });
}

function svgHeaders() {
  return {
    "content-type": "image/svg+xml; charset=utf-8",
    // Shields refresh on a short cadence; scores only change on reruns.
    "cache-control": "public, max-age=300, s-maxage=300",
  };
}

/** Shields-style two-segment badge, self-contained (no fonts fetched). */
function badgeSvg(label: string, value: string, color: string): string {
  const font =
    "font-family='Verdana,Geneva,DejaVu Sans,sans-serif' font-size='11'";
  const labelW = 7 * label.length + 14;
  const valueW = 7.5 * value.length + 16;
  const w = labelW + valueW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-opacity=".12"/></linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="4" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#1a1d23"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" ${font}>
    <text x="${labelW / 2}" y="14" fill="#e8eaed">${label}</text>
    <text x="${labelW + valueW / 2}" y="14" font-weight="bold">${value}</text>
  </g>
</svg>`;
}
