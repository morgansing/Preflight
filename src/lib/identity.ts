/**
 * Workspace identity for free-grant abuse resistance. Two signals, both
 * cheap to compute and hard to cycle:
 *
 * 1. Normalized email — collapses the plus-tag and gmail-dot tricks
 *    (john.doe+preflight@gmail.com and johndoe@gmail.com become one
 *    identity), so alias emails share a single 250-simulation grant.
 * 2. Device fingerprint — a coarse hash of stable browser signals, so a
 *    fresh email from the same browser doesn't reset the grant either.
 *
 * Neither is perfect alone; together they make farming free credits far
 * more work than it's worth. This module is pure/isomorphic — no
 * "use client" — so the server reuses normalizeEmail for enforcement.
 */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Collapse plus-tags and (for gmail) dots so aliases map to one identity. */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  // Drop everything after the first plus (sub-addressing) on any provider.
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

function hashString(s: string): string {
  // FNV-1a 32-bit → hex. Small, stable, non-cryptographic (fine here).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

let fingerprintCache: string | null = null;

/**
 * Coarse device fingerprint from stable, non-invasive signals. Browser
 * only — returns "" on the server. Deliberately NOT canvas/font
 * fingerprinting: this is grant-cycling friction, not surveillance.
 * Computed once per page — every signal is stable for the page's life.
 */
export function computeFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "";
  if (fingerprintCache !== null) return fingerprintCache;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    nav.userAgent ?? "",
    nav.language ?? "",
    (nav.languages ?? []).join(","),
    nav.platform ?? "",
    String(nav.hardwareConcurrency ?? ""),
    String(nav.deviceMemory ?? ""),
    `${window.screen?.width ?? ""}x${window.screen?.height ?? ""}x${window.screen?.colorDepth ?? ""}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ];
  fingerprintCache = hashString(parts.join("|"));
  return fingerprintCache;
}

export interface WorkspaceIdentity {
  email?: string;
  fingerprint?: string;
}
