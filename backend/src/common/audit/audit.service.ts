import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { RedisService } from '@/common/redis/redis.service';
import * as schema from '@/database/schema';

// Redis key for failed audit log queue (dead letter queue)
const AUDIT_DLQ_KEY = 'audit:dlq';
// Max items in DLQ before we stop accepting new ones
const AUDIT_DLQ_MAX_SIZE = 1000;
// Retry interval for processing DLQ (5 minutes)
const AUDIT_DLQ_RETRY_INTERVAL_MS = 5 * 60 * 1000;

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

      for (const item of items) {
        try {
          const input = JSON.parse(item) as AuditLogInput;
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

      if (processed > 0) {
        this.logger.log(`Processed ${processed}/${items.length} audit DLQ items`);
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
   * Queue failed audit log to Redis dead letter queue
   */
  private async queueToDlq(input: AuditLogInput): Promise<void> {
    try {
      const queueLength = await this.redis.lpush(AUDIT_DLQ_KEY, JSON.stringify(input));
      if (queueLength > AUDIT_DLQ_MAX_SIZE) {
        this.logger.warn(`Audit DLQ size (${queueLength}) exceeds max (${AUDIT_DLQ_MAX_SIZE})`);
      }
    } catch (dlqError) {
      this.logger.error(`Failed to queue audit log to DLQ: ${String(dlqError)}`);
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
