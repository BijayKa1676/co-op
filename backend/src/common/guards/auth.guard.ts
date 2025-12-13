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

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid authorization header');
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

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
