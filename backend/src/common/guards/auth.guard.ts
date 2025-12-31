import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef, Logger, OnModuleDestroy } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SupabaseService, SupabaseUser } from '@/common/supabase/supabase.service';
import { UsersService } from '@/modules/users/users.service';

export interface AuthenticatedUser extends SupabaseUser {
  onboardingCompleted: boolean;
  startupId: string | null;
}

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

export const SKIP_AUTH_RATE_LIMIT = 'skipAuthRateLimit';
export const SkipAuthRateLimit = () => 
  (target: object, _propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(SKIP_AUTH_RATE_LIMIT, true, descriptor.value);
    } else {
      Reflect.defineMetadata(SKIP_AUTH_RATE_LIMIT, true, target);
    }
    return descriptor ?? target;
  };

const TOKEN_VERIFY_WINDOW_MS = 60000;
const TOKEN_VERIFY_MAX_FAILED_ATTEMPTS = 10;
const ipFailedAttempts = new Map<string, { count: number; resetAt: number }>();

const TOKEN_CACHE_TTL_MS = 30000;
const TOKEN_CACHE_MAX_SIZE = 10000;
const TOKEN_CACHE_EVICT_BATCH = 1000; // Evict 10% at a time

interface TokenCacheEntry {
  userId: string;
  user: AuthenticatedUser;
  expiresAt: number;
  lastAccessed: number; // For LRU eviction
}

const tokenCache = new Map<string, TokenCacheEntry>();

let cleanupIntervalId: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    // Remove expired entries
    for (const [key, value] of tokenCache) {
      if (now > value.expiresAt) tokenCache.delete(key);
    }
    for (const [key, value] of ipFailedAttempts) {
      if (now > value.resetAt) ipFailedAttempts.delete(key);
    }
    
    // LRU eviction if still over capacity
    if (tokenCache.size > TOKEN_CACHE_MAX_SIZE) {
      evictLRU();
    }
  }, 60000);
}

/**
 * LRU eviction - remove least recently accessed entries
 */
function evictLRU(): void {
  if (tokenCache.size <= TOKEN_CACHE_MAX_SIZE) return;
  
  // Sort by lastAccessed (oldest first)
  const entries = Array.from(tokenCache.entries())
    .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  
  // Remove oldest entries until we're under capacity
  const toRemove = Math.min(TOKEN_CACHE_EVICT_BATCH, tokenCache.size - TOKEN_CACHE_MAX_SIZE + 100);
  for (let i = 0; i < toRemove && i < entries.length; i++) {
    tokenCache.delete(entries[i][0]);
  }
}

function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

startCleanupInterval();

@Injectable()
export class AuthGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly isProduction: boolean;
  private readonly trustProxy: boolean;

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.trustProxy = this.isProduction;
  }

  onModuleDestroy(): void {
    stopCleanupInterval();
    tokenCache.clear();
    ipFailedAttempts.clear();
  }

  private getTokenCacheKey(token: string): string {
    if (token.length < 100) return token;
    return `${token.substring(0, 64)}_${token.slice(-32)}`;
  }

  private getCachedAuth(token: string): AuthenticatedUser | null {
    const key = this.getTokenCacheKey(token);
    const cached = tokenCache.get(key);
    
    if (cached && Date.now() < cached.expiresAt) {
      // Update lastAccessed for LRU tracking
      cached.lastAccessed = Date.now();
      return cached.user;
    }
    if (cached) tokenCache.delete(key);
    return null;
  }

  private cacheAuth(token: string, user: AuthenticatedUser): void {
    const key = this.getTokenCacheKey(token);
    const now = Date.now();
    
    // Proactive eviction before adding
    if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) {
      // First pass: remove expired entries
      for (const [cacheKey, value] of tokenCache) {
        if (now > value.expiresAt) tokenCache.delete(cacheKey);
        if (tokenCache.size < TOKEN_CACHE_MAX_SIZE * 0.9) break;
      }
      
      // Second pass: LRU eviction if still over capacity
      if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) {
        evictLRU();
      }
    }
    
    tokenCache.set(key, { 
      userId: user.id, 
      user, 
      expiresAt: now + TOKEN_CACHE_TTL_MS,
      lastAccessed: now,
    });
  }

  private checkFailedAuthRateLimit(ip: string): void {
    const now = Date.now();
    const record = ipFailedAttempts.get(ip);
    
    if (!record || now > record.resetAt) return;
    
    if (record.count >= TOKEN_VERIFY_MAX_FAILED_ATTEMPTS) {
      this.logger.warn(`Auth rate limit exceeded for IP: ${ip.slice(0, 20)}...`);
      throw new UnauthorizedException('Too many failed authentication attempts. Please try again later.');
    }
  }

  private recordFailedAuth(ip: string): void {
    const now = Date.now();
    const record = ipFailedAttempts.get(ip);
    
    if (!record || now > record.resetAt) {
      ipFailedAttempts.set(ip, { count: 1, resetAt: now + TOKEN_VERIFY_WINDOW_MS });
    } else {
      record.count++;
    }
  }

  private getClientIp(request: AuthenticatedRequest & { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
    if (this.trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        const trimmedIp = ip?.trim();
        if (trimmedIp && this.isValidIp(trimmedIp)) return trimmedIp;
      }
    }
    return request.ip ?? 'unknown';
  }

  private isValidIp(ip: string): boolean {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { 
      ip?: string; 
      headers: Record<string, string | string[] | undefined>;
      query?: { token?: string };
    }>();
    
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const skipRateLimit = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_RATE_LIMIT, [
        context.getHandler(),
        context.getClass(),
      ]);
      
      if (skipRateLimit && request.query?.token) {
        token = request.query.token;
      }
    }

    if (!token) {
      this.logger.warn('Missing or invalid authorization header');
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const clientIp = this.getClientIp(request);

    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_RATE_LIMIT, [
      context.getHandler(),
      context.getClass(),
    ]);

    const cachedUser = this.getCachedAuth(token);
    if (cachedUser) {
      request.user = cachedUser;
      return true;
    }

    if (!skipRateLimit) this.checkFailedAuthRateLimit(clientIp);

    const supabaseUser = await this.supabase.verifyToken(token);

    if (!supabaseUser) {
      this.recordFailedAuth(clientIp);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const dbUser = await this.usersService.findOrCreateFromSupabase(
      supabaseUser.id,
      supabaseUser.email,
      supabaseUser.name,
      supabaseUser.authProvider,
    );

    const authenticatedUser: AuthenticatedUser = {
      ...supabaseUser,
      onboardingCompleted: dbUser.onboardingCompleted,
      startupId: dbUser.startup?.id ?? null,
    };

    this.cacheAuth(token, authenticatedUser);

    request.user = authenticatedUser;
    return true;
  }
}
