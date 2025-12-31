import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { RedisService } from '@/common/redis/redis.service';
import { QueryRequest, QueryResponse } from './rag.types';

/**
 * RAG Query Cache Service
 * Caches RAG query results to reduce latency and API calls
 * 
 * STALE CACHE STRATEGY:
 * - Primary cache with DEFAULT_TTL (30 min)
 * - Stale cache with STALE_TTL (2 hours) for fallback when service is down
 */
@Injectable()
export class RagCacheService {
  private readonly logger = new Logger(RagCacheService.name);
  private readonly CACHE_PREFIX = 'rag:query:';
  private readonly STALE_PREFIX = 'rag:stale:';
  private readonly DEFAULT_TTL = 30 * 60; // 30 minutes
  private readonly POPULAR_TTL = 60 * 60; // 1 hour for frequently accessed
  private readonly STALE_TTL = 2 * 60 * 60; // 2 hours for stale fallback

  constructor(private readonly redis: RedisService) {}

  /**
   * Generate cache key from query parameters
   */
  private getCacheKey(query: QueryRequest): string {
    const normalized = {
      query: query.query.toLowerCase().trim().replace(/\s+/g, ' '),
      domain: query.domain,
      sector: query.sector,
      region: query.region || 'global',
      jurisdictions: (query.jurisdictions || []).sort().join(','),
      documentType: query.documentType || 'any',
      limit: query.limit || 5,
    };
    
    const hash = createHash('md5')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .slice(0, 16);
    
    return `${this.CACHE_PREFIX}${hash}`;
  }

  /**
   * Get cached query result
   */
  async get(query: QueryRequest): Promise<QueryResponse | null> {
    const key = this.getCacheKey(query);
    const cached = await this.redis.get<QueryResponse>(key);
    
    if (cached) {
      this.logger.debug(`RAG cache hit: ${key}`);
      // Track access for popularity-based TTL extension
      await this.trackAccess(key);
      return cached;
    }
    
    this.logger.debug(`RAG cache miss: ${key}`);
    return null;
  }

  /**
   * Cache query result (both fresh and stale copies)
   */
  async set(query: QueryRequest, response: QueryResponse): Promise<void> {
    const key = this.getCacheKey(query);
    const staleKey = key.replace(this.CACHE_PREFIX, this.STALE_PREFIX);
    
    // Set both fresh and stale cache in parallel
    await Promise.all([
      this.redis.set(key, response, this.DEFAULT_TTL),
      this.redis.set(staleKey, response, this.STALE_TTL),
    ]);
    
    this.logger.debug(`RAG cache set: ${key}`);
  }

  /**
   * Get stale cache for fallback when service is unavailable
   * Returns data even if primary cache has expired
   */
  async getStale(query: QueryRequest): Promise<QueryResponse | null> {
    const key = this.getCacheKey(query);
    const staleKey = key.replace(this.CACHE_PREFIX, this.STALE_PREFIX);
    
    const cached = await this.redis.get<QueryResponse>(staleKey);
    
    if (cached) {
      this.logger.debug(`RAG stale cache hit: ${staleKey}`);
      return cached;
    }
    
    this.logger.debug(`RAG stale cache miss: ${staleKey}`);
    return null;
  }

  /**
   * Track access count for popularity-based caching
   */
  private async trackAccess(key: string): Promise<void> {
    const accessKey = `${key}:access`;
    const count = await this.redis.incr(accessKey);
    
    // Extend TTL for popular queries
    if (count > 5) {
      await this.redis.expire(key, this.POPULAR_TTL);
    }
  }

  /**
   * Invalidate cache for a specific domain/sector
   * Used when new documents are uploaded
   */
  async invalidateByDomain(domain: string, sector?: string): Promise<void> {
    // Note: In production, use Redis SCAN for pattern matching
    // For now, we rely on TTL expiration
    this.logger.log(`Cache invalidation requested for domain: ${domain}, sector: ${sector || 'all'}`);
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ hits: number; misses: number; size: number }> {
    // Simplified stats - in production, track these metrics properly
    return { hits: 0, misses: 0, size: 0 };
  }
}
