import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject, forwardRef, Logger } from '@nestjs/common';
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

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

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
   * Extract client IP from request
   */
  private getClientIp(request: AuthenticatedRequest & { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip?.trim() ?? 'unknown';
    }
    return request.ip ?? 'unknown';
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
