import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  WARMUP: 'warmup:',
} as const;

interface CacheOptions {
  ttl: number;
  prefix?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Cache warm-up configuration
 */
interface WarmupConfig {
  key: string;
  factory: () => Promise<unknown>;
  ttl: number;
  prefix?: string;
}

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultPrefix = 'cache:';
  
  // In-memory stats for monitoring
  private hits = 0;
  private misses = 0;
  
  // Warm-up registry
  private readonly warmupRegistry: WarmupConfig[] = [];

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    // Run cache warm-up on startup (non-blocking)
    if (this.warmupRegistry.length > 0) {
      void this.warmup();
    }
  }

  /**
   * Register a cache key for warm-up on startup
   */
  registerWarmup(config: WarmupConfig): void {
    this.warmupRegistry.push(config);
  }

  /**
   * Run cache warm-up for all registered keys
   */
  async warmup(): Promise<void> {
    if (this.warmupRegistry.length === 0) return;

    this.logger.log(`Warming up ${this.warmupRegistry.length} cache keys...`);
    const start = Date.now();

    const results = await Promise.allSettled(
      this.warmupRegistry.map(async (config) => {
        try {
          const value = await config.factory();
          await this.set(config.key, value, { ttl: config.ttl, prefix: config.prefix });
          return config.key;
        } catch (error) {
          this.logger.warn(`Failed to warm up cache key ${config.key}: ${String(error)}`);
          throw error;
        }
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const duration = Date.now() - start;
    this.logger.log(`Cache warm-up complete: ${succeeded}/${this.warmupRegistry.length} keys in ${duration}ms`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cached value
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    const fullKey = this.buildKey(key, prefix);
    const result = await this.redis.get<T>(fullKey);
    
    if (result !== null) {
      this.hits++;
    } else {
      this.misses++;
    }
    
    return result;
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
      this.hits++;
      this.logger.debug(`Cache hit: ${fullKey}`);
      return cached;
    }

    this.misses++;
    this.logger.debug(`Cache miss: ${fullKey}`);
    const value = await factory();
    await this.redis.set(fullKey, value, options.ttl);
    return value;
  }

  /**
   * Get or set with stale-while-revalidate pattern
   * Returns stale data immediately while refreshing in background
   */
  async getOrSetSWR<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions & { staleTime?: number }
  ): Promise<T> {
    const fullKey = this.buildKey(key, options.prefix);
    const metaKey = `${fullKey}:meta`;
    
    const [cached, meta] = await Promise.all([
      this.redis.get<T>(fullKey),
      this.redis.get<{ updatedAt: number }>(metaKey),
    ]);

    const now = Date.now();
    const staleTime = (options.staleTime ?? options.ttl / 2) * 1000;
    const isStale = meta ? (now - meta.updatedAt) > staleTime : true;

    // If we have cached data
    if (cached !== null) {
      this.hits++;
      
      // If stale, refresh in background
      if (isStale) {
        this.logger.debug(`Cache stale, refreshing in background: ${fullKey}`);
        void this.refreshInBackground(fullKey, metaKey, factory, options.ttl);
      }
      
      return cached;
    }

    // No cached data, fetch synchronously
    this.misses++;
    this.logger.debug(`Cache miss: ${fullKey}`);
    const value = await factory();
    await Promise.all([
      this.redis.set(fullKey, value, options.ttl),
      this.redis.set(metaKey, { updatedAt: now }, options.ttl),
    ]);
    return value;
  }

  private async refreshInBackground<T>(
    fullKey: string,
    metaKey: string,
    factory: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const value = await factory();
      await Promise.all([
        this.redis.set(fullKey, value, ttl),
        this.redis.set(metaKey, { updatedAt: Date.now() }, ttl),
      ]);
      this.logger.debug(`Background refresh complete: ${fullKey}`);
    } catch (error) {
      this.logger.warn(`Background refresh failed: ${fullKey} - ${String(error)}`);
    }
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

  /**
   * Get multiple cached values at once (batch operation)
   */
  async mget<T>(keys: string[], prefix?: string): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const fullKeys = keys.map(k => this.buildKey(k, prefix));
    return this.redis.mget<T>(fullKeys);
  }

  /**
   * Set multiple cached values at once (batch operation)
   */
  async mset(entries: { key: string; value: unknown; ttl: number }[], prefix?: string): Promise<void> {
    if (entries.length === 0) return;
    const redisEntries = entries.map(e => ({
      key: this.buildKey(e.key, prefix),
      value: e.value,
      ttl: e.ttl,
    }));
    await this.redis.mset(redisEntries);
    this.logger.debug(`Cache batch set: ${entries.length} keys`);
  }

  /**
   * Invalidate multiple keys at once
   */
  async invalidateMany(keys: string[], prefix?: string): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(keys.map(k => this.invalidate(k, prefix)));
    this.logger.debug(`Cache batch invalidated: ${keys.length} keys`);
  }

  /**
   * Get or set multiple values (batch operation)
   * Returns results in same order as keys
   */
  async mgetOrSet<T>(
    keys: string[],
    factory: (missingKeys: string[]) => Promise<Map<string, T>>,
    options: CacheOptions,
  ): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    // Get all from cache
    const cached = await this.mget<T>(keys, options.prefix);
    
    // Find missing keys
    const missingKeys: string[] = [];
    const missingIndices: number[] = [];
    cached.forEach((value, index) => {
      if (value === null) {
        missingKeys.push(keys[index]);
        missingIndices.push(index);
      }
    });

    // If all cached, return immediately
    if (missingKeys.length === 0) {
      this.logger.debug(`Cache batch hit: all ${keys.length} keys`);
      return cached;
    }

    this.logger.debug(`Cache batch: ${keys.length - missingKeys.length} hits, ${missingKeys.length} misses`);

    // Fetch missing values
    const fetched = await factory(missingKeys);

    // Cache the fetched values
    const toCache: { key: string; value: unknown; ttl: number }[] = [];
    for (const [key, value] of fetched) {
      toCache.push({ key, value, ttl: options.ttl });
    }
    if (toCache.length > 0) {
      await this.mset(toCache, options.prefix);
    }

    // Merge results
    const results = [...cached];
    for (let i = 0; i < missingKeys.length; i++) {
      const key = missingKeys[i];
      const index = missingIndices[i];
      results[index] = fetched.get(key) ?? null;
    }

    return results;
  }
}
