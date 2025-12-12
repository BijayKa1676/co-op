import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { AgentJobData, AgentJobResult, AGENTS_QUEUE } from './agents.queue.types';
import { AgentType, AgentInput } from '../types/agent.types';
import { TaskStatusDto, TaskState } from '../dto/task-status.dto';

interface AddJobResult {
  taskId: string;
  jobId: string;
}

@Injectable()
export class AgentsQueueService {
  private readonly logger = new Logger(AgentsQueueService.name);

  constructor(
    @InjectQueue(AGENTS_QUEUE)
    private readonly agentsQueue: Queue<AgentJobData, AgentJobResult>,
  ) {}

  async addJob(agentType: AgentType, input: AgentInput, userId: string): Promise<AddJobResult> {
    const taskId = uuid();

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
    this.logger.log(`Added agent job ${jobId} for ${agentType}`);

    return { taskId, jobId };
  }

  async getJob(taskId: string): Promise<Job<AgentJobData, AgentJobResult> | null> {
    const job = await this.agentsQueue.getJob(taskId);
    return job ?? null;
  }

  async getJobStatus(taskId: string): Promise<TaskStatusDto | null> {
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

  async cancelJob(taskId: string): Promise<boolean> {
    const job = await this.getJob(taskId);

    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }
}
