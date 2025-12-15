import { Injectable, Logger } from '@nestjs/common';
import * as Opossum from 'opossum';

// Handle CommonJS/ESM interop
const CircuitBreaker = (Opossum as { default?: typeof Opossum }).default ?? Opossum;
type CircuitBreakerInstance = InstanceType<typeof CircuitBreaker>;

interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold: number;
}

interface CircuitBreakerStats {
  state: string;
  failures: number;
  successes: number;
  fallbacks: number;
  timeouts: number;
  cacheHits: number;
  cacheMisses: number;
  percentile95: number;
  percentile99: number;
}

type AsyncFunction<T> = (...args: unknown[]) => Promise<T>;

// Maximum number of circuit breakers to prevent memory leaks
const MAX_BREAKERS = 100;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreakerInstance>();
  private readonly breakerLastUsed = new Map<string, number>();

  private readonly defaultOptions: CircuitBreakerOptions = {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
  };

  /**
   * Clean up least recently used breakers if we exceed MAX_BREAKERS
   */
  private cleanupOldBreakers(): void {
    if (this.breakers.size <= MAX_BREAKERS) return;

    // Sort by last used time and remove oldest
    const entries = Array.from(this.breakerLastUsed.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const toRemove = entries.slice(0, this.breakers.size - MAX_BREAKERS + 10);
    for (const [name] of toRemove) {
      const breaker = this.breakers.get(name);
      if (breaker) {
        breaker.shutdown();
      }
      this.breakers.delete(name);
      this.breakerLastUsed.delete(name);
    }
    
    this.logger.log(`Cleaned up ${String(toRemove.length)} old circuit breakers`);
  }

  create<T>(
    name: string,
    fn: AsyncFunction<T>,
    options?: Partial<CircuitBreakerOptions>,
  ): CircuitBreakerInstance {
    const existingBreaker = this.breakers.get(name);
    if (existingBreaker) {
      this.breakerLastUsed.set(name, Date.now());
      return existingBreaker;
    }

    // Clean up old breakers if we're at capacity
    this.cleanupOldBreakers();

    const mergedOptions = { ...this.defaultOptions, ...options };

    const breaker = new CircuitBreaker(fn, {
      timeout: mergedOptions.timeout,
      errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
      resetTimeout: mergedOptions.resetTimeout,
      volumeThreshold: mergedOptions.volumeThreshold,
    }) as CircuitBreakerInstance;

    breaker.on('open', () => {
      this.logger.warn(`Circuit breaker "${name}" opened`);
    });

    breaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker "${name}" half-open`);
    });

    breaker.on('close', () => {
      this.logger.log(`Circuit breaker "${name}" closed`);
    });

    breaker.on('fallback', () => {
      this.logger.debug(`Circuit breaker "${name}" fallback triggered`);
    });

    breaker.on('timeout', () => {
      this.logger.warn(`Circuit breaker "${name}" timeout`);
    });

    this.breakers.set(name, breaker);
    this.breakerLastUsed.set(name, Date.now());
    return breaker;
  }

  async execute<T>(name: string, fn: AsyncFunction<T>, fallback?: () => T): Promise<T> {
    const breaker = this.breakers.get(name) ?? this.create(name, fn);
    this.breakerLastUsed.set(name, Date.now());

    if (fallback) {
      breaker.fallback(fallback);
    }

    // Fire with the provided function arguments
    return breaker.fire() as Promise<T>;
  }

  /**
   * Execute a function with circuit breaker protection (one-time use)
   * Use this when the function changes between calls
   */
  async executeOnce<T>(name: string, fn: AsyncFunction<T>, fallback?: () => T): Promise<T> {
    const existingBreaker = this.breakers.get(name);
    
    // Check if existing breaker is open
    if (existingBreaker?.opened) {
      this.logger.debug(`Circuit breaker "${name}" is open, using fallback`);
      if (fallback) return fallback();
      throw new Error(`Circuit breaker "${name}" is open`);
    }

    // Create temporary breaker with same settings but new function
    const tempBreaker = new CircuitBreaker(fn, {
      timeout: this.defaultOptions.timeout,
      errorThresholdPercentage: this.defaultOptions.errorThresholdPercentage,
      resetTimeout: this.defaultOptions.resetTimeout,
      volumeThreshold: this.defaultOptions.volumeThreshold,
    }) as CircuitBreakerInstance;

    if (fallback) {
      tempBreaker.fallback(fallback);
    }

    try {
      const result = await (tempBreaker.fire() as Promise<T>);
      return result;
    } catch (error) {
      // If this fails, mark the main breaker as having a failure
      if (!existingBreaker) {
        // Create the main breaker to track state
        this.create(name, fn);
      }
      throw error;
    }
  }

  getStats(name: string): CircuitBreakerStats | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    const stats = breaker.stats;
    const statusName = breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed';
    return {
      state: statusName,
      failures: stats.failures,
      successes: stats.successes,
      fallbacks: stats.fallbacks,
      timeouts: stats.timeouts,
      cacheHits: stats.cacheHits,
      cacheMisses: stats.cacheMisses,
      percentile95: stats.latencyMean,
      percentile99: stats.latencyMean,
    };
  }

  getAllStats(): Record<string, CircuitBreakerStats> {
    const allStats: Record<string, CircuitBreakerStats> = {};
    for (const [name] of this.breakers) {
      const stats = this.getStats(name);
      if (stats) {
        allStats[name] = stats;
      }
    }
    return allStats;
  }

  isOpen(name: string): boolean {
    const breaker = this.breakers.get(name);
    return breaker ? breaker.opened : false;
  }
}
