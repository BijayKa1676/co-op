import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '@/common/guards/auth.guard';

export type CurrentUserPayload = AuthenticatedUser;

type UserFieldValue = string | boolean | Record<string, unknown> | null;

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | UserFieldValue => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (data) {
      return user[data] as UserFieldValue;
    }

    return user;
  },
);
