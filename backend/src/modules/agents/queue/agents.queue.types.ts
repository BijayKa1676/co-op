import { AgentType, AgentInput, AgentPhaseResult } from '../types/agent.types';

export interface AgentJobData {
  taskId: string;
  agentType: AgentType;
  input: AgentInput;
  userId: string;
}

export interface AgentJobResult {
  success: boolean;
  results: AgentPhaseResult[];
  error: string;
  completedAt: Date;
}

// Queue name constant (kept for compatibility)
export const AGENTS_QUEUE = 'agents';
