import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentJobResult } from '../queue/agents.queue.types';

export type TaskState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'unknown';

export class TaskStatusDto {
  @ApiProperty({
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused', 'unknown'],
  })
  status: TaskState;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  result?: AgentJobResult;

  @ApiPropertyOptional()
  error?: string;
}

export interface SSEConnectedEvent {
  taskId: string;
  timestamp: string;
}

export type SSEStatusEvent = TaskStatusDto;

export interface SSEDoneEvent {
  status: TaskState;
}
