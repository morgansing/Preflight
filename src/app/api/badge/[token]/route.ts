import { type NextRequest } from "next/server";
import { badgeData } from "@/server/share";
import { clientKey, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * The Preflight badge — a self-contained evidence mark, embeddable in any
 * README. Public by design; the token is unguessable and read-only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!rateLimit(`badge:${clientKey(request)}`)) {
    return new Response("rate limited", { status: 429, headers: { "retry-after": "2" } });
  }
  const { token } = await params;
  const data = await badgeData(token);
  if (!data) {
    return new Response(badgeSvg(null), {
      status: 404,
      headers: svgHeaders(),
    });
  }
  return new Response(badgeSvg(data.score), { headers: svgHeaders() });
}

function svgHeaders() {
  return {
    "content-type": "image/svg+xml; charset=utf-8",
    // Shields refresh on a short cadence; scores only change on reruns.
    "cache-control": "public, max-age=300, s-maxage=300",
  };
}

/** Compact evidence mark, self-contained and readable in light or dark READMEs. */
function badgeSvg(score: number | null): string {
  const status = score === null ? "UNKNOWN" : score >= 90 ? "READY" : score >= 75 ? "REVIEW" : "BLOCKED";
  const color = score === null ? "#818894" : score >= 90 ? "#42df8b" : score >= 75 ? "#e0a43e" : "#ff5c57";
  const scoreLabel = score === null ? "—" : String(Math.round(score));
  const aria = score === null
    ? "Preflight readiness unknown"
    : `Preflight readiness ${scoreLabel} percent, ${status.toLowerCase()}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="24" viewBox="0 0 150 24" role="img" aria-label="${aria}">
  <title>${aria}</title>
  <defs>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151b18"/>
      <stop offset="1" stop-color="#0b0f0d"/>
    </linearGradient>
    <filter id="signal" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
  <rect x=".5" y=".5" width="149" height="23" rx="6" fill="url(#panel)" stroke="#2b3932"/>
  <circle cx="11" cy="12" r="4" fill="${color}" opacity=".18" filter="url(#signal)"/>
  <circle cx="11" cy="12" r="2.6" fill="${color}"/>
  <text x="18" y="15.2" fill="#d9e0dc" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="8" font-weight="700" letter-spacing="1">PREFLIGHT</text>
  <path d="M78 6v12" stroke="#2b3932"/>
  <text x="85" y="16" fill="#f2f5f3" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="12" font-weight="700">${scoreLabel}</text>
  <text x="114" y="15" fill="${color}" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="6.8" font-weight="700" letter-spacing=".55">${status}</text>
</svg>`;
}
