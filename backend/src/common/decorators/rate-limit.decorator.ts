import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the time window */
  limit: number;
  /** Time window in seconds */
  ttl: number;
  /** Optional key prefix for grouping rate limits */
  keyPrefix?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to apply rate limiting to a controller or route
 * @param options Rate limit configuration
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

// Preset rate limits for common use cases
export const RateLimitPresets = {
  /** Standard API rate limit: 100 requests per minute */
  STANDARD: { limit: 100, ttl: 60 },
  /** Strict rate limit for sensitive operations: 10 requests per minute */
  STRICT: { limit: 10, ttl: 60 },
  /** Very strict for creation operations: 5 requests per minute */
  CREATE: { limit: 5, ttl: 60 },
  /** Relaxed for read operations: 200 requests per minute */
  READ: { limit: 200, ttl: 60 },
  /** Burst protection: 30 requests per 10 seconds */
  BURST: { limit: 30, ttl: 10 },
} as const;
