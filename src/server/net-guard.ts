import { config } from "./config";

/**
 * Guard for user-supplied URLs the server will fetch (agent endpoints,
 * policy pages). Blocks the obvious server-side request forgery targets:
 * loopback, private ranges, link-local/metadata services. A hostname/IP
 * screen, not a DNS-rebinding-proof egress proxy — the production
 * hardening path is documented in docs/PRODUCTION.md.
 *
 * Outside production (or with PREFLIGHT_ALLOW_PRIVATE_ENDPOINTS=1) private
 * hosts are allowed: pointing Preflight at an agent on localhost is the
 * normal self-hosted dev workflow.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true; // loopback, private, this-net
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isPrivateIpv4(host)) return true;
  // IPv6 literals arrive bracketed from URL.hostname on some runtimes.
  const bare = host.replace(/^\[|\]$/g, "");
  if (bare === "::1" || bare === "::") return true;
  if (/^(fc|fd)[0-9a-f]{2}:/.test(bare)) return true; // unique-local
  if (/^fe[89ab][0-9a-f]:/.test(bare)) return true; // link-local
  if (bare.startsWith("::ffff:")) return isPrivateIpv4(bare.slice(7)); // v4-mapped
  return false;
}

/**
 * Validate a user-supplied URL the server intends to fetch.
 * Throws with a user-presentable reason when refused.
 */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  if (!config.allowPrivateEndpoints && isPrivateHost(url.hostname)) {
    throw new Error(
      "That host resolves to a private or internal address, which this server won't fetch. " +
        "Use a publicly reachable URL (or a tunnel like ngrok / Cloudflare Tunnel).",
    );
  }
  return url;
}
