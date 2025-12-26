import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef, Logger } from '@nestjs/common';
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

// Rate limiting for token verification (prevents brute force attacks)
const TOKEN_VERIFY_WINDOW_MS = 60000; // 1 minute window
const TOKEN_VERIFY_MAX_ATTEMPTS = 20; // Max 20 attempts per IP per minute
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

// Trusted proxy hosts (Render, Vercel, Cloudflare, Koyeb)
const TRUSTED_PROXY_HOSTS = [
  'onrender.com',
  'vercel.app',
  'cloudflare.com',
  'koyeb.app',
];

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly isProduction: boolean;
  private readonly trustProxy: boolean;

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    // Trust proxy headers in production (behind Render/Vercel/Cloudflare)
    this.trustProxy = this.isProduction;
  }

  /**
   * Check rate limit for token verification attempts
   */
  private checkRateLimit(ip: string): void {
    const now = Date.now();
    const record = ipAttempts.get(ip);
    
    if (!record || now > record.resetAt) {
      // New window or expired window
      ipAttempts.set(ip, { count: 1, resetAt: now + TOKEN_VERIFY_WINDOW_MS });
      return;
    }
    
    if (record.count >= TOKEN_VERIFY_MAX_ATTEMPTS) {
      this.logger.warn(`Rate limit exceeded for IP: ${ip.slice(0, 20)}...`);
      throw new UnauthorizedException('Too many authentication attempts. Please try again later.');
    }
    
    record.count++;
  }

  /**
   * Extract client IP from request with proxy validation
   * Only trusts x-forwarded-for in production behind known proxies
   */
  private getClientIp(request: AuthenticatedRequest & { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
    // Only trust forwarded headers if we're behind a trusted proxy
    if (this.trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        // Take the first IP (client IP) from the chain
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        const trimmedIp = ip?.trim();
        if (trimmedIp && this.isValidIp(trimmedIp)) {
          return trimmedIp;
        }
      }
    }
    return request.ip ?? 'unknown';
  }

  /**
   * Basic IP validation to prevent header injection
   */
  private isValidIp(ip: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { ip?: string; headers: Record<string, string | string[] | undefined> }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid authorization header');
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    // Rate limit token verification attempts per IP
    const clientIp = this.getClientIp(request);
    this.checkRateLimit(clientIp);

    const token = authHeader.substring(7);

    const supabaseUser = await this.supabase.verifyToken(token);

    if (!supabaseUser) {
      this.logger.warn('Token verification failed - invalid or expired token');
      throw new UnauthorizedException('Invalid or expired token');
    }

    this.logger.debug(`Authenticated user: ${supabaseUser.id} (${supabaseUser.email})`);

    // Sync user to our database (creates if not exists)
    const dbUser = await this.usersService.findOrCreateFromSupabase(
      supabaseUser.id,
      supabaseUser.email,
      supabaseUser.name,
      supabaseUser.authProvider,
    );

    // Merge Supabase user info with our database info
    request.user = {
      ...supabaseUser,
      onboardingCompleted: dbUser.onboardingCompleted,
      startupId: dbUser.startup?.id ?? null,
    };

    return true;
  }
}
