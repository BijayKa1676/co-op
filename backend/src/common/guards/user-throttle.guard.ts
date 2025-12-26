import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { RedisService } from '@/common/redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '@/common/decorators/rate-limit.decorator';

@Injectable()
export class UserThrottleGuard implements CanActivate {
  private readonly THROTTLE_PREFIX = 'throttle:';
  private readonly DEFAULT_TTL = 60; // seconds
  private readonly DEFAULT_LIMIT = 100;

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { id: string };
      ip: string;
      path: string;
      method: string;
    }>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get rate limit options from decorator (method first, then class)
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const limit = rateLimitOptions?.limit ?? this.DEFAULT_LIMIT;
    const ttl = rateLimitOptions?.ttl ?? this.DEFAULT_TTL;
    const keyPrefix = rateLimitOptions?.keyPrefix ?? '';

    // Use user ID if authenticated, otherwise use IP
    const identifier = request.user?.id ?? request.ip;
    const pathKey = keyPrefix || `${request.method}:${request.path}`;
    const key = `${this.THROTTLE_PREFIX}${identifier}:${pathKey}`;

    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, ttl);
    }

    // Add rate limit headers for client visibility
    const remaining = Math.max(0, limit - current);
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));

    if (current > limit) {
      response.setHeader('Retry-After', String(ttl));
      throw new ThrottlerException(`Rate limit exceeded. Maximum ${String(limit)} requests per ${String(ttl)} seconds.`);
    }

    return true;
  }
}
