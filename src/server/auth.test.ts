import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isServiceToken, verifySupabaseJwt } from "./auth";

const SECRET = "test-secret";

function makeJwt(
  payload: Record<string, unknown>,
  { secret = SECRET, alg = "HS256" }: { secret?: string; alg?: string } = {},
): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg, typ: "JWT" });
  const body = enc(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

describe("verifySupabaseJwt", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;

  it("accepts a valid token and returns its claims", () => {
    const token = makeJwt({ sub: "user-1", email: "a@b.c", exp: future, aud: "authenticated" });
    const payload = verifySupabaseJwt(token, SECRET);
    expect(payload).toMatchObject({ sub: "user-1", email: "a@b.c" });
  });

  it("rejects a tampered signature", () => {
    const token = makeJwt({ sub: "user-1", exp: future }, { secret: "wrong-secret" });
    expect(verifySupabaseJwt(token, SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = makeJwt({ sub: "user-1", exp: future });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "attacker", exp: future })).toString(
      "base64url",
    );
    expect(verifySupabaseJwt(`${h}.${forged}.${s}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 });
    expect(verifySupabaseJwt(token, SECRET)).toBeNull();
  });

  it("rejects the wrong audience", () => {
    const token = makeJwt({ sub: "user-1", exp: future, aud: "anon" });
    expect(verifySupabaseJwt(token, SECRET)).toBeNull();
  });

  it("rejects non-HS256 algorithms (alg-substitution)", () => {
    const token = makeJwt({ sub: "user-1", exp: future }, { alg: "none" });
    expect(verifySupabaseJwt(token, SECRET)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySupabaseJwt("not-a-jwt", SECRET)).toBeNull();
    expect(verifySupabaseJwt("", SECRET)).toBeNull();
  });
});

describe("isServiceToken", () => {
  it("accepts only an exact match", () => {
    expect(isServiceToken("tok_abc123", "tok_abc123")).toBe(true);
    expect(isServiceToken("tok_abc124", "tok_abc123")).toBe(false);
    expect(isServiceToken("tok_abc", "tok_abc123")).toBe(false);
    expect(isServiceToken("", "tok_abc123")).toBe(false);
  });
});
