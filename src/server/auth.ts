import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "./config";

/**
 * Auth seam — fully built, dormant until Supabase credentials exist.
 *
 * Dormant (no SUPABASE_JWT_SECRET): every request acts as the single
 * self-hosted workspace user, exactly like today.
 *
 * Active (secret set): mutating routes require a Supabase access token
 * (`Authorization: Bearer <jwt>`), verified locally — HS256 signature
 * against the project's JWT secret, expiry, and the "authenticated"
 * audience. No SDK, no network call, nothing else to install.
 */

export interface AuthedUser {
  id: string;
  email?: string;
}

type AuthResult = { user: AuthedUser; response?: never } | { user?: never; response: NextResponse };

/** Gate a mutating route. Usage:
 *    const auth = requireUser(request);
 *    if (auth.response) return auth.response;
 *    // auth.user is the verified caller
 */
export function requireUser(request: Request): AuthResult {
  if (!config.auth.enabled) {
    // Single-workspace mode — the self-hosted default.
    return { user: { id: "default" } };
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const payload = token ? verifySupabaseJwt(token, config.auth.jwtSecret!) : null;
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

interface JwtPayload {
  sub: string;
  email?: string;
  exp?: number;
  aud?: string | string[];
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

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as JwtPayload;
    if (!payload.sub) return null;
    if (payload.exp !== undefined && payload.exp * 1000 < Date.now()) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (aud.length > 0 && !aud.includes("authenticated")) return null;
    return payload;
  } catch {
    return null;
  }
}
