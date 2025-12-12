import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '@/common/supabase/supabase.service';
import { UsersService } from '@/modules/users/users.service';
import { AuthenticatedUser } from './auth.guard';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ForbiddenException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    const supabaseUser = await this.supabase.verifyToken(token);

    if (!supabaseUser) {
      throw new ForbiddenException('Invalid or expired token');
    }

    if (supabaseUser.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

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
