/**
 * In-memory token-bucket rate limiter for the public endpoints (badge,
 * shared report). Per-process by design — good for a single instance;
 * swap for edge middleware or a shared store when scaling out.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitOptions {
  /** Bucket size — the burst allowance. */
  capacity?: number;
  /** Tokens added per second. */
  refillPerSec?: number;
}

/** True = allowed; false = the caller should get a 429. */
export function rateLimit(
  key: string,
  { capacity = 20, refillPerSec = 10 }: RateLimitOptions = {},
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    // Cheap memory guard: reset the table rather than tracking LRU.
    if (buckets.size >= MAX_KEYS) buckets.clear();
    bucket = { tokens: capacity, lastRefill: now };
    buckets.set(key, bucket);
  }
  bucket.tokens = Math.min(
    capacity,
    bucket.tokens + ((now - bucket.lastRefill) / 1000) * refillPerSec,
  );
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Client key for a request — first XFF hop, or a local fallback. */
export function clientKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : "local";
}
