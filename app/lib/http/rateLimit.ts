import { AppError } from './errors';

/**
 * Minimal fixed-window rate limiter for unauthenticated endpoints (login, password recovery).
 * In-memory and per server process: it blunts brute-force/enumeration from a single client but is
 * not shared across instances — put a shared limiter (reverse proxy / Redis) in front in production.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many attempts. Please wait a few minutes and try again.') {
    super(429, message, 'RATE_LIMITED');
  }
}

export function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new TooManyRequestsError();
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}
