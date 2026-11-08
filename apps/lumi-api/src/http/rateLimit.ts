/**
 * Fixed-window request limiter. Failures return a structured code — never a
 * diary payload — and do not depend on Redis for the first VPS profile.
 */
export type RateLimitResult =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterSec: number };

export function createFixedWindowRateLimiter(input: {
  readonly limit: number;
  readonly windowMs: number;
  readonly nowMs?: () => number;
}) {
  const buckets = new Map<string, { count: number; resetAtMs: number }>();
  const nowMs = input.nowMs ?? (() => Date.now());

  return {
    check(key: string): RateLimitResult {
      const now = nowMs();
      const current = buckets.get(key);
      if (!current || current.resetAtMs <= now) {
        buckets.set(key, { count: 1, resetAtMs: now + input.windowMs });
        return { allowed: true, remaining: input.limit - 1 };
      }
      if (current.count >= input.limit) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((current.resetAtMs - now) / 1000)),
        };
      }
      current.count += 1;
      return { allowed: true, remaining: input.limit - current.count };
    },
  };
}
