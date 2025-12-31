import { Injectable, Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry'>> = {
  maxAttempts: 5, // Increased from 3 for better resilience
  initialDelayMs: 1000,
  maxDelayMs: 30000, // Increased from 10000 for longer backoff
  backoffMultiplier: 2,
};

/**
 * Retry Service with exponential backoff and full jitter
 * Provides automatic retry logic for transient failures
 * 
 * Uses "full jitter" algorithm for better distribution:
 * delay = random(0, min(maxDelay, baseDelay * 2^attempt))
 * 
 * Reference: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  
  // Metrics for monitoring retry behavior
  private retryAttempts = 0;
  private retrySuccesses = 0;
  private retryFailures = 0;

  /**
   * Get retry metrics for monitoring
   */
  getMetrics(): { attempts: number; successes: number; failures: number } {
    return {
      attempts: this.retryAttempts,
      successes: this.retrySuccesses,
      failures: this.retryFailures,
    };
  }

  /**
   * Execute a function with automatic retry on failure
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const result = await fn();
        if (attempt > 1) {
          this.retrySuccesses++;
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        this.retryAttempts++;
        
        // Check if error is retryable
        if (!this.isRetryable(lastError, opts.retryableErrors)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === opts.maxAttempts) {
          break;
        }

        // Calculate delay with full jitter (better distribution than decorrelated jitter)
        // Full jitter: delay = random(0, min(maxDelay, baseDelay * 2^attempt))
        // Add minimum delay floor to prevent 0ms delays
        const exponentialDelay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
        // Ensure minimum delay of 100ms to prevent tight retry loops
        const minDelay = Math.max(100, cappedDelay * 0.1);
        const actualDelay = minDelay + Math.random() * (cappedDelay - minDelay);

        this.logger.warn(
          `Attempt ${attempt}/${opts.maxAttempts} failed: ${lastError.message}. Retrying in ${Math.round(actualDelay)}ms`,
        );

        opts.onRetry?.(attempt, lastError, actualDelay);

        await this.sleep(actualDelay);
      }
    }

    this.retryFailures++;
    this.logger.error(`All ${opts.maxAttempts} attempts failed`);
    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: Error, retryableErrors?: string[]): boolean {
    const message = error.message.toLowerCase();
    
    // Default retryable conditions
    const defaultRetryable = [
      'timeout',
      'econnreset',
      'econnrefused',
      'socket hang up',
      'network',
      'rate limit',
      '429',
      '503',
      '502',
      '504',
      'temporarily unavailable',
      'service unavailable',
    ];

    const patterns = retryableErrors || defaultRetryable;
    return patterns.some((pattern) => message.includes(pattern.toLowerCase()));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic retry
 */
export function WithRetry(options: RetryOptions = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const retryService = new RetryService();
      return retryService.execute(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
