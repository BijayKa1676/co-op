import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/redis/redis.service';
import { timingSafeEqual } from 'crypto';

interface ApiKeyRequest {
  headers: { 'x-api-key'?: string };
}

interface ApiKeyData {
  id: string;
  name: string;
  userId: string;
  scopes: string[];
  createdAt: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly API_KEY_PREFIX = 'apikey:';

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const masterKey = this.configService.get<string>('MASTER_API_KEY');
    if (masterKey && this.timingSafeEqual(apiKey, masterKey)) {
      return true;
    }

    const keyData = await this.redis.get<ApiKeyData>(`${this.API_KEY_PREFIX}${apiKey}`);
    if (!keyData) {
      throw new UnauthorizedException('Invalid API key');
    }

    (request as ApiKeyRequest & { apiKeyData: ApiKeyData }).apiKeyData = keyData;
    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const maxLen = Math.max(a.length, b.length);
    const paddedA = a.padEnd(maxLen, '\0');
    const paddedB = b.padEnd(maxLen, '\0');
    return timingSafeEqual(Buffer.from(paddedA), Buffer.from(paddedB)) && a.length === b.length;
  }
}
