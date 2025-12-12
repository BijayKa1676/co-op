import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupabaseUser } from '@/common/supabase/supabase.service';

export type CurrentUserPayload = SupabaseUser;

type UserFieldValue = string | Record<string, unknown>;

export const CurrentUser = createParamDecorator(
  (data: keyof SupabaseUser | undefined, ctx: ExecutionContext): SupabaseUser | UserFieldValue => {
    const request = ctx.switchToHttp().getRequest<{ user: SupabaseUser }>();
    const user = request.user;

    if (data) {
      return user[data];
    }

    return user;
  },
);
