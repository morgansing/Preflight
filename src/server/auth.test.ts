import { createHmac, generateKeyPairSync, sign as cryptoSign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isServiceToken, verifyJwtWithJwks, verifySupabaseJwt, type Jwks } from "./auth";

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

function makeAsymJwt(
  payload: Record<string, unknown>,
  { alg, key, kid }: { alg: "ES256" | "RS256"; key: KeyObject; kid?: string },
): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg, typ: "JWT", kid });
  const body = enc(payload);
  const data = Buffer.from(`${head}.${body}`);
  const sig =
    alg === "ES256"
      ? cryptoSign("sha256", data, { key, dsaEncoding: "ieee-p1363" })
      : cryptoSign("sha256", data, key);
  return `${head}.${body}.${sig.toString("base64url")}`;
}

describe("verifyJwtWithJwks", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwks: Jwks = {
    keys: [
      { ...(ec.publicKey.export({ format: "jwk" }) as object), kid: "ec-1", alg: "ES256" } as Jwks["keys"][number],
      { ...(rsa.publicKey.export({ format: "jwk" }) as object), kid: "rsa-1", alg: "RS256" } as Jwks["keys"][number],
    ],
  };

  it("accepts a valid ES256 token (Supabase signing keys)", () => {
    const token = makeAsymJwt(
      { sub: "user-1", email: "a@b.c", exp: future, aud: "authenticated" },
      { alg: "ES256", key: ec.privateKey, kid: "ec-1" },
    );
    expect(verifyJwtWithJwks(token, jwks)).toMatchObject({ sub: "user-1", email: "a@b.c" });
  });

  it("accepts a valid RS256 token", () => {
    const token = makeAsymJwt(
      { sub: "user-2", exp: future, aud: "authenticated" },
      { alg: "RS256", key: rsa.privateKey, kid: "rsa-1" },
    );
    expect(verifyJwtWithJwks(token, jwks)).toMatchObject({ sub: "user-2" });
  });

  it("rejects a token signed by a different key", () => {
    const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const token = makeAsymJwt(
      { sub: "user-1", exp: future },
      { alg: "ES256", key: other.privateKey, kid: "ec-1" },
    );
    expect(verifyJwtWithJwks(token, jwks)).toBeNull();
  });

  it("rejects an HS256 token on the asymmetric path (alg confusion)", () => {
    const token = makeJwt({ sub: "user-1", exp: future });
    expect(verifyJwtWithJwks(token, jwks)).toBeNull();
  });

  it("rejects an unknown kid", () => {
    const token = makeAsymJwt(
      { sub: "user-1", exp: future },
      { alg: "ES256", key: ec.privateKey, kid: "nope" },
    );
    expect(verifyJwtWithJwks(token, jwks)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = makeAsymJwt(
      { sub: "user-1", exp: Math.floor(Date.now() / 1000) - 10 },
      { alg: "ES256", key: ec.privateKey, kid: "ec-1" },
    );
    expect(verifyJwtWithJwks(token, jwks)).toBeNull();
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
