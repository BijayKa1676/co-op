import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AgentType,
  AgentInput,
  AgentPhaseResult,
  OrchestratorTask,
  BaseAgent,
} from '../types/agent.types';
import { LegalAgentService } from '../domains/legal/legal-agent.service';
import { FinanceAgentService } from '../domains/finance/finance-agent.service';
import { InvestorAgentService } from '../domains/investor/investor-agent.service';
import { CompetitorAgentService } from '../domains/competitor/competitor-agent.service';

// Task cleanup interval (1 hour)
const TASK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
// Task max age (24 hours)
const TASK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrchestratorService implements OnModuleDestroy {
  private readonly logger = new Logger(OrchestratorService.name);
  private readonly tasks = new Map<string, OrchestratorTask>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly legalAgent: LegalAgentService,
    private readonly financeAgent: FinanceAgentService,
    private readonly investorAgent: InvestorAgentService,
    private readonly competitorAgent: CompetitorAgentService,
  ) {
    // Start periodic cleanup of old tasks to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTasks();
    }, TASK_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up tasks older than TASK_MAX_AGE_MS to prevent memory leaks
   */
  private cleanupOldTasks(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [taskId, task] of this.tasks) {
      if (now - task.createdAt.getTime() > TASK_MAX_AGE_MS) {
        this.tasks.delete(taskId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${String(cleaned)} old tasks`);
    }
  }

  private getAgent(type: AgentType): BaseAgent {
    const agents: Record<AgentType, BaseAgent> = {
      legal: this.legalAgent,
      finance: this.financeAgent,
      investor: this.investorAgent,
      competitor: this.competitorAgent,
    };
    return agents[type];
  }

  async runAgent(
    agentType: AgentType,
    input: AgentInput,
    onProgress?: (step: string) => void,
  ): Promise<AgentPhaseResult[]> {
    const agent = this.getAgent(agentType);
    const results: AgentPhaseResult[] = [];
    const agentName = agentType.charAt(0).toUpperCase() + agentType.slice(1);

    try {
      this.logger.log(`Running ${agentType} agent - Draft phase`);
      onProgress?.(`${agentName} agent: Generating initial draft...`);
      const draft = await agent.runDraft(input, onProgress);
      results.push({ phase: 'draft', output: draft, timestamp: new Date() });
      onProgress?.(`${agentName} agent: Draft complete`);

      this.logger.log(`Running ${agentType} agent - Critique phase`);
      onProgress?.(`${agentName} agent: Self-critiquing response...`);
      const critique = await agent.runCritique(input, draft, onProgress);
      results.push({ phase: 'critique', output: critique, timestamp: new Date() });
      onProgress?.(`${agentName} agent: Critique complete`);

      this.logger.log(`Running ${agentType} agent - Final phase`);
      onProgress?.(`${agentName} agent: Generating final response...`);
      const final = await agent.runFinal(input, draft, critique, onProgress);
      results.push({ phase: 'final', output: final, timestamp: new Date() });
      onProgress?.(`${agentName} agent: Final response ready`);

      return results;
    } catch (error) {
      this.logger.error(`Agent ${agentType} execution failed`, error);
      throw error;
    }
  }

  createTask(agentType: AgentType, input: AgentInput): string {
    const taskId = uuid();
    const task: OrchestratorTask = {
      id: taskId,
      agentType,
      input,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(taskId, task);
    return taskId;
  }

  getTask(taskId: string): OrchestratorTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = 'Cancelled by user';
      task.updatedAt = new Date();
    }
  }
}
