import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { RedisService } from '@/common/redis/redis.service';
import * as schema from '@/database/schema';

// Redis key for failed audit log queue (dead letter queue)
const AUDIT_DLQ_KEY = 'audit:dlq';
// Max items in DLQ before we start trimming old entries
const AUDIT_DLQ_MAX_SIZE = 1000;
// Retry interval for processing DLQ (5 minutes)
const AUDIT_DLQ_RETRY_INTERVAL_MS = 5 * 60 * 1000;
// DLQ item TTL (7 days) - items older than this are considered stale
const AUDIT_DLQ_TTL_DAYS = 7;

interface AuditLogInput {
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

interface AuditLogResponse {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface AuditLogQuery {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private dlqRetryInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    // Start DLQ retry processor
    this.dlqRetryInterval = setInterval(() => {
      void this.processDlq();
    }, AUDIT_DLQ_RETRY_INTERVAL_MS);
    
    // Process any existing DLQ items on startup
    void this.processDlq();
  }

  onModuleDestroy(): void {
    if (this.dlqRetryInterval) {
      clearInterval(this.dlqRetryInterval);
      this.dlqRetryInterval = null;
    }
  }

  /**
   * Process dead letter queue - retry failed audit logs
   */
  private async processDlq(): Promise<void> {
    try {
      const items = await this.redis.lrange(AUDIT_DLQ_KEY, 0, 50);
      if (items.length === 0) return;

      this.logger.log(`Processing ${items.length} items from audit DLQ`);
      let processed = 0;
      let expired = 0;
      const maxAge = AUDIT_DLQ_TTL_DAYS * 24 * 60 * 60 * 1000;

      for (const item of items) {
        try {
          const parsed = JSON.parse(item) as AuditLogInput & { _dlqTimestamp?: number };
          
          // Check if item is too old (stale)
          if (parsed._dlqTimestamp && Date.now() - parsed._dlqTimestamp > maxAge) {
            // Remove stale item without processing
            await this.redis.lrem(AUDIT_DLQ_KEY, 1, item);
            expired++;
            continue;
          }
          
          // Remove internal timestamp before inserting
          const { _dlqTimestamp, ...input } = parsed;
          
          await this.db.insert(schema.auditLogs).values({
            userId: input.userId,
            action: input.action,
            resource: input.resource,
            resourceId: input.resourceId,
            oldValue: input.oldValue,
            newValue: input.newValue,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            metadata: input.metadata,
          });
          // Remove from DLQ on success
          await this.redis.lrem(AUDIT_DLQ_KEY, 1, item);
          processed++;
        } catch {
          // Leave in DLQ for next retry
        }
      }

      if (processed > 0 || expired > 0) {
        this.logger.log(`Audit DLQ: processed ${processed}, expired ${expired} of ${items.length} items`);
      }
    } catch (error) {
      this.logger.warn(`Failed to process audit DLQ: ${String(error)}`);
    }
  }

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.db.insert(schema.auditLogs).values({
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        oldValue: input.oldValue,
        newValue: input.newValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${String(error)}`);
      // Queue to Redis DLQ for retry
      await this.queueToDlq(input);
    }
  }

  /**
   * Queue failed audit log to Redis dead letter queue with overflow handling
   */
  private async queueToDlq(input: AuditLogInput): Promise<void> {
    try {
      // Add timestamp for TTL tracking
      const dlqItem = JSON.stringify({
        ...input,
        _dlqTimestamp: Date.now(),
      });
      
      const queueLength = await this.redis.lpush(AUDIT_DLQ_KEY, dlqItem);
      
      // If queue exceeds max size, trim oldest entries instead of rejecting new ones
      // This ensures recent audit logs are preserved while preventing unbounded growth
      if (queueLength > AUDIT_DLQ_MAX_SIZE) {
        this.logger.warn(`Audit DLQ size (${queueLength}) exceeds max (${AUDIT_DLQ_MAX_SIZE}), trimming oldest entries`);
        // Keep only the most recent AUDIT_DLQ_MAX_SIZE items
        // Note: This is a Redis LTRIM operation - keeps items from 0 to MAX_SIZE-1
        await this.trimDlq();
      }
    } catch (dlqError) {
      this.logger.error(`Failed to queue audit log to DLQ: ${String(dlqError)}`);
    }
  }

  /**
   * Trim DLQ to max size, removing oldest entries
   */
  private async trimDlq(): Promise<void> {
    try {
      // Get items beyond the max size and remove them
      const items = await this.redis.lrange(AUDIT_DLQ_KEY, AUDIT_DLQ_MAX_SIZE, -1);
      for (const item of items) {
        await this.redis.lrem(AUDIT_DLQ_KEY, 1, item);
      }
      this.logger.log(`Trimmed ${items.length} old items from audit DLQ`);
    } catch (error) {
      this.logger.warn(`Failed to trim audit DLQ: ${String(error)}`);
    }
  }

  async query(query: AuditLogQuery): Promise<AuditLogResponse[]> {
    const conditions = [];

    if (query.userId) {
      conditions.push(eq(schema.auditLogs.userId, query.userId));
    }
    if (query.action) {
      conditions.push(eq(schema.auditLogs.action, query.action));
    }
    if (query.resource) {
      conditions.push(eq(schema.auditLogs.resource, query.resource));
    }
    if (query.resourceId) {
      conditions.push(eq(schema.auditLogs.resourceId, query.resourceId));
    }
    if (query.startDate) {
      conditions.push(gte(schema.auditLogs.createdAt, query.startDate));
    }
    if (query.endDate) {
      conditions.push(lte(schema.auditLogs.createdAt, query.endDate));
    }

    const logs = await this.db
      .select()
      .from(schema.auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(query.limit ?? 100)
      .offset(query.offset ?? 0);

    return logs.map(log => this.toResponse(log));
  }

  async getByResourceId(resource: string, resourceId: string): Promise<AuditLogResponse[]> {
    const logs = await this.db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.resource, resource), eq(schema.auditLogs.resourceId, resourceId)))
      .orderBy(desc(schema.auditLogs.createdAt));

    return logs.map(log => this.toResponse(log));
  }

  private toResponse(log: schema.AuditLog): AuditLogResponse {
    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      oldValue: log.oldValue as Record<string, unknown> | null,
      newValue: log.newValue as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata as Record<string, unknown>,
      createdAt: log.createdAt,
    };
  }
}
