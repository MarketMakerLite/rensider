import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting proxy with token bucket algorithm
 *
 * Features:
 * - Separate limits for sync endpoints vs general API
 * - Token bucket for smooth rate limiting
 * - Security headers on all API responses
 * - Trusted proxy headers only in production (Vercel sets x-forwarded-for securely)
 */

const RATE_LIMITS = {
  sync: { requests: 10, windowMs: 60_000 },
  api: { requests: 100, windowMs: 60_000 },
};

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Extract client IP address securely
 * - In production (Vercel): Trust x-forwarded-for (set by Vercel's proxy)
 * - In development: Use a fallback since headers may be spoofed
 */
function getClientIP(request: NextRequest): string {
  // In production on Vercel, x-forwarded-for is set securely by Vercel's proxy
  if (IS_PRODUCTION) {
    // x-forwarded-for format: "client, proxy1, proxy2" - take the first (client) IP
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const clientIP = forwarded.split(',')[0].trim();
      // Basic validation that it looks like an IP
      if (/^[\d.:a-f]+$/i.test(clientIP)) {
        return clientIP;
      }
    }
    // Fallback to x-real-ip (also set by Vercel)
    const realIP = request.headers.get('x-real-ip');
    if (realIP && /^[\d.:a-f]+$/i.test(realIP)) {
      return realIP;
    }
  }

  // In development, use a placeholder - rate limiting per-IP less critical locally
  return 'dev-local';
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

function checkRateLimit(
  key: string,
  config: { requests: number; windowMs: number }
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: config.requests, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / config.windowMs) * config.requests;
  bucket.tokens = Math.min(config.requests, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens--;
    return true;
  }

  return false;
}

// Clean up old buckets periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function maybeCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  // Remove buckets that haven't been used in 10 minutes
  const staleThreshold = 10 * 60 * 1000;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > staleThreshold) {
      buckets.delete(key);
    }
  }
}

export function proxy(request: NextRequest) {
  maybeCleanup();

  const ip = getClientIP(request);
  const path = request.nextUrl.pathname;

  // Determine rate limit config based on path
  const isSync = path.startsWith('/api/sync');
  const config = isSync ? RATE_LIMITS.sync : RATE_LIMITS.api;
  const bucketKey = `${ip}:${isSync ? 'sync' : 'api'}`;

  if (!checkRateLimit(bucketKey, config)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      }
    );
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
