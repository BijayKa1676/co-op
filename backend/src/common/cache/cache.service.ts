import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/common/redis/redis.service';

/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute - for rapidly changing data
  MEDIUM: 300, // 5 minutes - for user sessions, API responses
  LONG: 3600, // 1 hour - for user profiles, startup data
  DAY: 86400, // 24 hours - for static data
} as const;

/**
 * Cache key prefixes
 */
export const CACHE_PREFIX = {
  USER: 'user:',
  STARTUP: 'startup:',
  SESSION: 'session:',
  AGENT: 'agent:',
  MCP: 'mcp:',
  RATE_LIMIT: 'rate:',
  API_KEY: 'apikey:',
} as const;

interface CacheOptions {
  ttl: number;
  prefix?: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultPrefix = 'cache:';

  constructor(private readonly redis: RedisService) {}

  /**
   * Get cached value
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    const fullKey = this.buildKey(key, prefix);
    return this.redis.get<T>(fullKey);
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: unknown, options: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix);
    await this.redis.set(fullKey, value, options.ttl);
    this.logger.debug(`Cache set: ${fullKey} (TTL: ${String(options.ttl)}s)`);
  }

  /**
   * Get or set - returns cached value or fetches and caches
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options: CacheOptions): Promise<T> {
    const fullKey = this.buildKey(key, options.prefix);
    const cached = await this.redis.get<T>(fullKey);

    if (cached !== null) {
      this.logger.debug(`Cache hit: ${fullKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss: ${fullKey}`);
    const value = await factory();
    await this.redis.set(fullKey, value, options.ttl);
    return value;
  }

  /**
   * Invalidate single key
   */
  async invalidate(key: string, prefix?: string): Promise<void> {
    const fullKey = this.buildKey(key, prefix);
    await this.redis.del(fullKey);
    this.logger.debug(`Cache invalidated: ${fullKey}`);
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, prefix);
    return this.redis.exists(fullKey);
  }

  /**
   * Extend TTL on existing key
   */
  async touch(key: string, ttl: number, prefix?: string): Promise<void> {
    const fullKey = this.buildKey(key, prefix);
    await this.redis.expire(fullKey, ttl);
  }

  /**
   * Increment counter (for rate limiting)
   */
  async increment(key: string, prefix?: string): Promise<number> {
    const fullKey = this.buildKey(key, prefix);
    return this.redis.incr(fullKey);
  }

  /**
   * Get user cache key
   */
  userKey(userId: string): string {
    return `${CACHE_PREFIX.USER}${userId}`;
  }

  /**
   * Get startup cache key
   */
  startupKey(startupId: string): string {
    return `${CACHE_PREFIX.STARTUP}${startupId}`;
  }

  /**
   * Get session cache key
   */
  sessionKey(sessionId: string): string {
    return `${CACHE_PREFIX.SESSION}${sessionId}`;
  }

  /**
   * Get API key cache key
   */
  apiKeyKey(keyHash: string): string {
    return `${CACHE_PREFIX.API_KEY}${keyHash}`;
  }

  /**
   * Build full cache key
   */
  private buildKey(key: string, prefix?: string): string {
    return `${prefix ?? this.defaultPrefix}${key}`;
  }
}
