import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SupabaseService, SupabaseUser } from '@/common/supabase/supabase.service';

interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: SupabaseUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new ForbiddenException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    const user = await this.supabase.verifyToken(token);

    if (!user) {
      throw new ForbiddenException('Invalid or expired token');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    request.user = user;
    return true;
  }
}
