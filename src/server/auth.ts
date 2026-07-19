import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "./config";

/**
 * Auth seam — fully built, dormant until Supabase credentials exist.
 *
 * Dormant (no Supabase env vars): every request acts as the single
 * self-hosted workspace user, exactly like today.
 *
 * Active: mutating routes require a Supabase access token
 * (`Authorization: Bearer <jwt>`), verified locally. Two verification
 * paths, tried in order:
 *   - HS256 against SUPABASE_JWT_SECRET (legacy projects), and/or
 *   - the project's published JWKS (ES256/RS256 signing keys — the
 *     default on new projects), fetched once from
 *     NEXT_PUBLIC_SUPABASE_URL and cached.
 * Setting either env var activates the gate; both may be set during a
 * key migration.
 */

export interface AuthedUser {
  id: string;
  email?: string;
}

type AuthResult = { user: AuthedUser; response?: never } | { user?: never; response: NextResponse };

/** Gate a mutating route. Usage:
 *    const auth = await requireUser(request);
 *    if (auth.response) return auth.response;
 *    // auth.user is the verified caller
 */
export async function requireUser(request: Request): Promise<AuthResult> {
  if (!config.auth.enabled) {
    // Single-workspace mode — the self-hosted default.
    return { user: { id: "default" } };
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  // Headless callers (the CI gate) authenticate with the service token —
  // machines can't complete a browser login.
  if (config.auth.apiToken && isServiceToken(token, config.auth.apiToken)) {
    return { user: { id: "service:ci" } };
  }
  let payload: JwtPayload | null = null;
  if (token) {
    if (config.auth.jwtSecret) {
      payload = verifySupabaseJwt(token, config.auth.jwtSecret);
    }
    if (!payload && config.auth.supabaseUrl) {
      const jwks = await getProjectJwks(config.auth.supabaseUrl);
      if (jwks) payload = verifyJwtWithJwks(token, jwks);
    }
  }
  if (!payload) {
    return {
      response: NextResponse.json(
        { error: "Sign in required.", authRequired: true },
        { status: 401 },
      ),
    };
  }
  return { user: { id: payload.sub, email: payload.email } };
}

/** Constant-time service-token comparison. */
export function isServiceToken(given: string, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

interface JwtPayload {
  sub: string;
  email?: string;
  exp?: number;
  aud?: string | string[];
}

/** Shared claim checks: subject present, unexpired, right audience. */
function validateClaims(payloadB64: string): JwtPayload | null {
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf8"),
  ) as JwtPayload;
  if (!payload.sub) return null;
  if (payload.exp !== undefined && payload.exp * 1000 < Date.now()) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (aud.length > 0 && !aud.includes("authenticated")) return null;
  return payload;
}

/** Minimal HS256 JWT verification — signature, expiry, audience. */
export function verifySupabaseJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    if (header.alg !== "HS256") return null;
    const expected = createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const given = Buffer.from(sigB64, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return validateClaims(payloadB64);
  } catch {
    return null;
  }
}

export interface Jwks {
  keys: Array<{ kid?: string; kty: string; alg?: string } & Record<string, unknown>>;
}

/** Verify against a JWKS document — ES256/RS256 only (Supabase signing
 * keys), never HS256, so a symmetric token can't slip through this path. */
export function verifyJwtWithJwks(token: string, jwks: Jwks): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== "ES256" && header.alg !== "RS256") return null;
    const jwk = jwks.keys.find(
      (k) => (header.kid ? k.kid === header.kid : true) && (!k.alg || k.alg === header.alg),
    );
    if (!jwk) return null;
    const key = createPublicKey({ key: jwk as never, format: "jwk" });
    const data = Buffer.from(`${headerB64}.${payloadB64}`);
    const sig = Buffer.from(sigB64, "base64url");
    const ok =
      header.alg === "ES256"
        ? cryptoVerify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig)
        : cryptoVerify("sha256", data, key, sig);
    if (!ok) return null;
    return validateClaims(payloadB64);
  } catch {
    return null;
  }
}

/** JWKS cache — one fetch per server process per TTL, stale kept on
 * fetch failure so a blip at Supabase doesn't sign everyone out. */
const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = ((globalThis as Record<string, unknown>).__preflightJwks ??= {}) as {
  url?: string;
  jwks?: Jwks;
  fetchedAt?: number;
};

async function getProjectJwks(supabaseUrl: string): Promise<Jwks | null> {
  const fresh =
    jwksCache.url === supabaseUrl &&
    jwksCache.jwks &&
    Date.now() - (jwksCache.fetchedAt ?? 0) < JWKS_TTL_MS;
  if (fresh) return jwksCache.jwks!;
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const jwks = (await res.json()) as Jwks;
    if (!Array.isArray(jwks.keys)) throw new Error("jwks shape");
    jwksCache.url = supabaseUrl;
    jwksCache.jwks = jwks;
    jwksCache.fetchedAt = Date.now();
    return jwks;
  } catch {
    // Stale beats nothing; null only when we've never fetched.
    return jwksCache.url === supabaseUrl ? (jwksCache.jwks ?? null) : null;
  }
}
