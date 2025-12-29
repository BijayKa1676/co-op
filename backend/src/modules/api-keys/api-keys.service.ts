import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { RedisService } from '@/common/redis/redis.service';
import { AuditService } from '@/common/audit/audit.service';
import { CreateApiKeyDto, ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto';

interface StoredApiKey {
  id: string;
  name: string;
  userId: string;
  scopes: string[];
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface ApiKeyUsageStats {
  keyId: string;
  keyName: string;
  keyPrefix: string;
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  lastUsedAt: Date | null;
}

export interface UserApiKeyUsageSummary {
  totalKeys: number;
  activeKeys: number;
  totalRequestsToday: number;
  totalRequestsThisMonth: number;
  keyUsage: ApiKeyUsageStats[];
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly API_KEY_PREFIX = 'apikey:';
  private readonly API_KEY_HASH_PREFIX = 'apikey:hash:';
  private readonly USER_KEYS_PREFIX = 'user:apikeys:';
  private readonly API_KEY_USAGE_PREFIX = 'apikey:usage:';
  private readonly API_KEY_REVOKED_PREFIX = 'apikey:revoked:';
  private readonly KEY_TTL = 365 * 24 * 60 * 60; // 1 year
  
  // Configurable pilot limits (from env vars)
  private readonly pilotKeyLimit: number;
  private readonly pilotMonthlyLimit: number;

  constructor(
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.pilotKeyLimit = this.configService.get<number>('PILOT_API_KEY_LIMIT', 1);
    this.pilotMonthlyLimit = this.configService.get<number>('PILOT_API_KEY_MONTHLY_REQUESTS', 3);
  }

  async create(userId: string, dto: CreateApiKeyDto): Promise<ApiKeyCreatedResponseDto> {
    // Validate name length
    if (dto.name.length > 100) {
      throw new BadRequestException('API key name must be 100 characters or less');
    }

    // Validate scopes
    const validScopes = ['read', 'write', 'agents', 'sessions'];
    if (dto.scopes.some(scope => !validScopes.includes(scope))) {
      throw new BadRequestException('Invalid scope provided');
    }

    // Pilot program: Configurable API key limit per user
    const existingKeys = await this.findByUser(userId);
    if (existingKeys.length >= this.pilotKeyLimit) {
      throw new BadRequestException(`Pilot program allows only ${this.pilotKeyLimit} API key(s) per user. Delete your existing key to create a new one.`);
    }

    const id = randomBytes(8).toString('hex');
    const rawKey = `coop_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const storedKey: StoredApiKey = {
      id,
      name: dto.name,
      userId,
      scopes: dto.scopes,
      keyHash,
      keyPrefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    // Store by raw key for lookup during authentication
    await this.redis.set(
      `${this.API_KEY_PREFIX}${rawKey}`,
      {
        id: storedKey.id,
        name: storedKey.name,
        userId: storedKey.userId,
        scopes: storedKey.scopes,
        keyHash: storedKey.keyHash,
        createdAt: storedKey.createdAt,
      },
      this.KEY_TTL,
    );

    // Store hash -> raw key mapping for revocation (hash is safe to store)
    await this.redis.set(`${this.API_KEY_HASH_PREFIX}${keyHash}`, rawKey, this.KEY_TTL);

    // Store by ID for management (no raw key stored - only hash for revocation)
    await this.redis.hset(`${this.USER_KEYS_PREFIX}${userId}`, id, storedKey);

    // Audit log
    await this.audit.log({
      userId,
      action: 'api_key.created',
      resource: 'api_key',
      resourceId: id,
      oldValue: null,
      newValue: { name: dto.name, scopes: dto.scopes, keyPrefix },
      ipAddress: null,
      userAgent: null,
      metadata: {},
    });

    return {
      id,
      name: dto.name,
      key: rawKey,
      keyPrefix,
      scopes: dto.scopes,
      createdAt: new Date(storedKey.createdAt),
      lastUsedAt: new Date(storedKey.lastUsedAt),
    };
  }

  async findByUser(userId: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.redis.hgetall<StoredApiKey>(`${this.USER_KEYS_PREFIX}${userId}`);
    if (!keys) {
      return [];
    }

    return Object.values(keys).map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      createdAt: new Date(key.createdAt),
      lastUsedAt: new Date(key.lastUsedAt),
    }));
  }

  async revoke(userId: string, keyId: string): Promise<void> {
    // Validate keyId format to prevent injection
    if (!keyId || !/^[a-f0-9]{16}$/.test(keyId)) {
      throw new BadRequestException('Invalid API key ID format');
    }

    const keys = await this.redis.hgetall<StoredApiKey>(`${this.USER_KEYS_PREFIX}${userId}`);
    const keyData = keys?.[keyId];

    if (!keyData) {
      throw new NotFoundException('API key not found');
    }

    // IMMEDIATE REVOCATION: Add to revocation list first (checked during auth)
    // This ensures the key is immediately invalid even if other deletions fail
    await this.redis.set(`${this.API_KEY_REVOKED_PREFIX}${keyData.keyHash}`, '1', this.KEY_TTL);

    // Look up raw key from hash mapping for deletion
    const rawKey = await this.redis.get<string>(`${this.API_KEY_HASH_PREFIX}${keyData.keyHash}`);
    if (rawKey) {
      await this.redis.del(`${this.API_KEY_PREFIX}${rawKey}`);
      await this.redis.del(`${this.API_KEY_HASH_PREFIX}${keyData.keyHash}`);
    }

    // Remove from user's keys
    await this.redis.hdel(`${this.USER_KEYS_PREFIX}${userId}`, keyId);

    // Audit log
    await this.audit.log({
      userId,
      action: 'api_key.revoked',
      resource: 'api_key',
      resourceId: keyId,
      oldValue: { name: keyData.name, keyPrefix: keyData.keyPrefix },
      newValue: null,
      ipAddress: null,
      userAgent: null,
      metadata: {},
    });

    this.logger.log(`API key ${keyId} revoked for user ${userId}`);
  }

  /**
   * Check if an API key has been revoked (for immediate revocation support)
   */
  async isRevoked(keyHash: string): Promise<boolean> {
    const revoked = await this.redis.get<string>(`${this.API_KEY_REVOKED_PREFIX}${keyHash}`);
    return revoked === '1';
  }

  async checkUsageLimit(rawKey: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    if (!rawKey || typeof rawKey !== 'string' || rawKey.length < 10) {
      return { allowed: false, remaining: 0, limit: this.pilotMonthlyLimit };
    }

    const keyData = await this.redis.get<StoredApiKey>(`${this.API_KEY_PREFIX}${rawKey}`);
    if (!keyData || !keyData.id) {
      return { allowed: false, remaining: 0, limit: this.pilotMonthlyLimit };
    }

    // Check if key has been revoked
    if (await this.isRevoked(keyData.keyHash)) {
      return { allowed: false, remaining: 0, limit: this.pilotMonthlyLimit };
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyKey = `${this.API_KEY_USAGE_PREFIX}${keyData.id}:monthly:${month}`;
    
    const currentUsage = await this.redis.get<number>(monthlyKey) ?? 0;
    const remaining = Math.max(0, this.pilotMonthlyLimit - currentUsage);
    
    return {
      allowed: currentUsage < this.pilotMonthlyLimit,
      remaining,
      limit: this.pilotMonthlyLimit,
    };
  }

  async updateLastUsed(rawKey: string): Promise<void> {
    const keyData = await this.redis.get<StoredApiKey>(`${this.API_KEY_PREFIX}${rawKey}`);
    if (keyData) {
      await this.redis.hset(`${this.USER_KEYS_PREFIX}${keyData.userId}`, keyData.id, {
        ...keyData,
        lastUsedAt: new Date().toISOString(),
      });
      await this.redis.expire(`${this.API_KEY_PREFIX}${rawKey}`, this.KEY_TTL);
      await this.incrementUsage(keyData.id);
    }
  }

  private async incrementUsage(keyId: string): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const dailyKey = `${this.API_KEY_USAGE_PREFIX}${keyId}:daily:${today}`;
    await this.redis.incr(dailyKey);
    await this.redis.expire(dailyKey, 86400 * 7);

    const monthlyKey = `${this.API_KEY_USAGE_PREFIX}${keyId}:monthly:${month}`;
    await this.redis.incr(monthlyKey);
    await this.redis.expire(monthlyKey, 86400 * 35);

    const totalKey = `${this.API_KEY_USAGE_PREFIX}${keyId}:total`;
    await this.redis.incr(totalKey);
  }

  async getKeyUsage(keyId: string, userId: string): Promise<ApiKeyUsageStats | null> {
    const keys = await this.redis.hgetall<StoredApiKey>(`${this.USER_KEYS_PREFIX}${userId}`);
    const keyData = keys?.[keyId];

    if (!keyData) return null;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [totalRequests, requestsToday, requestsThisMonth] = await Promise.all([
      this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${keyId}:total`),
      this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${keyId}:daily:${today}`),
      this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${keyId}:monthly:${month}`),
    ]);

    return {
      keyId: keyData.id,
      keyName: keyData.name,
      keyPrefix: keyData.keyPrefix,
      totalRequests: totalRequests ?? 0,
      requestsToday: requestsToday ?? 0,
      requestsThisMonth: requestsThisMonth ?? 0,
      lastUsedAt: keyData.lastUsedAt ? new Date(keyData.lastUsedAt) : null,
    };
  }

  async getUserUsageSummary(userId: string): Promise<UserApiKeyUsageSummary> {
    const keys = await this.findByUser(userId);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const keyUsage: ApiKeyUsageStats[] = [];
    let totalRequestsToday = 0;
    let totalRequestsThisMonth = 0;
    let activeKeys = 0;

    for (const key of keys) {
      const [totalRequests, requestsToday, requestsThisMonth] = await Promise.all([
        this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${key.id}:total`),
        this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${key.id}:daily:${today}`),
        this.redis.get<number>(`${this.API_KEY_USAGE_PREFIX}${key.id}:monthly:${month}`),
      ]);

      const stats: ApiKeyUsageStats = {
        keyId: key.id,
        keyName: key.name,
        keyPrefix: key.keyPrefix,
        totalRequests: totalRequests ?? 0,
        requestsToday: requestsToday ?? 0,
        requestsThisMonth: requestsThisMonth ?? 0,
        lastUsedAt: key.lastUsedAt,
      };

      keyUsage.push(stats);
      totalRequestsToday += stats.requestsToday;
      totalRequestsThisMonth += stats.requestsThisMonth;

      // Consider key active if used in last 7 days
      if (key.lastUsedAt && new Date(key.lastUsedAt) > sevenDaysAgo) {
        activeKeys++;
      }
    }

    return {
      totalKeys: keys.length,
      activeKeys,
      totalRequestsToday,
      totalRequestsThisMonth,
      keyUsage,
    };
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
