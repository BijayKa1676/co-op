import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { QStashService } from '@/common/qstash';
import { RedisService } from '@/common/redis/redis.service';
import { AgentJobData, AgentJobResult, AGENTS_QUEUE } from './agents.queue.types';
import { AgentType, AgentInput } from '../types/agent.types';
import { TaskStatusDto, TaskState } from '../dto/task-status.dto';

interface AddJobResult {
  taskId: string;
  jobId: string;
  provider: 'qstash' | 'bullmq';
}

const TASK_STATUS_PREFIX = 'task:status:';
const TASK_RESULT_PREFIX = 'task:result:';
const TASK_TTL = 86400; // 24 hours

@Injectable()
export class AgentsQueueService {
  private readonly logger = new Logger(AgentsQueueService.name);

  constructor(
    @InjectQueue(AGENTS_QUEUE)
    private readonly agentsQueue: Queue<AgentJobData, AgentJobResult>,
    private readonly qstash: QStashService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Add a job to the queue
   * Uses QStash if available, falls back to BullMQ
   */
  async addJob(agentType: AgentType, input: AgentInput, userId: string): Promise<AddJobResult> {
    const taskId = uuid();

    // Try QStash first (serverless, better for production)
    if (this.qstash.isAvailable()) {
      try {
        const result = await this.qstash.publish({
          taskId,
          type: agentType,
          payload: {
            agentType,
            input,
          },
          userId,
          createdAt: new Date().toISOString(),
        });

        // Store initial status in Redis
        await this.redis.set(
          `${TASK_STATUS_PREFIX}${taskId}`,
          { status: 'waiting', progress: 0, createdAt: new Date().toISOString() },
          TASK_TTL,
        );

        this.logger.log(`QStash job published: ${result.messageId} for ${agentType}`);
        return { taskId, jobId: result.messageId, provider: 'qstash' };
      } catch (error) {
        this.logger.warn(`QStash publish failed, falling back to BullMQ: ${String(error)}`);
      }
    }

    // Fallback to BullMQ
    const job = await this.agentsQueue.add(
      `${agentType}-task`,
      {
        taskId,
        agentType,
        input,
        userId,
      },
      {
        jobId: taskId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: {
          age: 86400,
        },
      },
    );

    const jobId = job.id ?? taskId;
    this.logger.log(`BullMQ job added: ${jobId} for ${agentType}`);

    return { taskId, jobId, provider: 'bullmq' };
  }

  /**
   * Get job from BullMQ (for backward compatibility)
   */
  async getJob(taskId: string): Promise<Job<AgentJobData, AgentJobResult> | null> {
    const job = await this.agentsQueue.getJob(taskId);
    return job ?? null;
  }

  /**
   * Get job status (checks both QStash Redis status and BullMQ)
   */
  async getJobStatus(taskId: string): Promise<TaskStatusDto | null> {
    // First check Redis for QStash job status
    const qstashStatus = await this.redis.get<{
      status: string;
      progress: number;
      result?: AgentJobResult;
      error?: string;
    }>(`${TASK_STATUS_PREFIX}${taskId}`);

    if (qstashStatus) {
      return {
        status: qstashStatus.status as TaskState,
        progress: qstashStatus.progress,
        result: qstashStatus.result,
        error: qstashStatus.error,
      };
    }

    // Fallback to BullMQ
    const job = await this.getJob(taskId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    return {
      status: state as TaskState,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Update task status (called by webhook handler for QStash jobs)
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskState,
    progress: number,
    result?: AgentJobResult,
    error?: string,
  ): Promise<void> {
    await this.redis.set(
      `${TASK_STATUS_PREFIX}${taskId}`,
      { status, progress, result, error, updatedAt: new Date().toISOString() },
      TASK_TTL,
    );

    if (result) {
      await this.redis.set(`${TASK_RESULT_PREFIX}${taskId}`, result, TASK_TTL);
    }

    this.logger.debug(`Task ${taskId} status updated: ${status} (${String(progress)}%)`);
  }

  /**
   * Get task result
   */
  async getTaskResult(taskId: string): Promise<AgentJobResult | null> {
    // Check Redis first (QStash results)
    const result = await this.redis.get<AgentJobResult>(`${TASK_RESULT_PREFIX}${taskId}`);
    if (result) {
      return result;
    }

    // Fallback to BullMQ
    const job = await this.getJob(taskId);
    return job?.returnvalue ?? null;
  }

  /**
   * Cancel a job
   */
  async cancelJob(taskId: string): Promise<boolean> {
    // For QStash, we can only mark it as cancelled in Redis
    // The webhook will check this before processing
    const qstashStatus = await this.redis.get(`${TASK_STATUS_PREFIX}${taskId}`);
    if (qstashStatus) {
      await this.redis.set(
        `${TASK_STATUS_PREFIX}${taskId}`,
        { status: 'cancelled', progress: 0, cancelledAt: new Date().toISOString() },
        TASK_TTL,
      );
      return true;
    }

    // Fallback to BullMQ
    const job = await this.getJob(taskId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Check if task was cancelled (for webhook handler)
   */
  async isTaskCancelled(taskId: string): Promise<boolean> {
    const status = await this.redis.get<{ status: string }>(`${TASK_STATUS_PREFIX}${taskId}`);
    return status?.status === 'cancelled';
  }
}
