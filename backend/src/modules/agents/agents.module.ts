import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { OrchestratorService } from './orchestrator/orchestrator.service';
import { AgentsQueueService } from './queue/agents.queue.service';
import { AgentsProcessor } from './queue/agents.processor';
import { AgentsWebhookController } from './queue/agents.webhook.controller';
import { AGENTS_QUEUE } from './queue/agents.queue.types';
import { A2AService } from './a2a/a2a.service';
import { LlmModule } from '@/common/llm/llm.module';
import { RagModule } from '@/common/rag/rag.module';
import { ResearchModule } from '@/common/research/research.module';
import { RedisModule } from '@/common/redis/redis.module';
import { QStashModule } from '@/common/qstash/qstash.module';
import { StartupsModule } from '@/modules/startups/startups.module';

import { LegalAgentService } from './domains/legal/legal-agent.service';
import { FinanceAgentService } from './domains/finance/finance-agent.service';
import { InvestorAgentService } from './domains/investor/investor-agent.service';
import { CompetitorAgentService } from './domains/competitor/competitor-agent.service';

@Module({
  imports: [
    LlmModule,
    RagModule,
    ResearchModule,
    RedisModule,
    QStashModule,
    StartupsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Upstash Redis connection for BullMQ
        // Uses TLS for secure connection
        const host = config.get<string>('UPSTASH_REDIS_HOST', '');
        const port = config.get<number>('UPSTASH_REDIS_PORT', 6379);
        const password = config.get<string>('UPSTASH_REDIS_PASSWORD', '');

        return {
          connection: {
            host,
            port,
            password,
            tls: {}, // Required for Upstash
            maxRetriesPerRequest: null, // Required for BullMQ
            enableReadyCheck: false, // Faster startup
            retryStrategy: (times: number) => Math.min(times * 100, 3000),
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: AGENTS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    }),
  ],
  controllers: [AgentsController, AgentsWebhookController],
  providers: [
    AgentsService,
    OrchestratorService,
    AgentsQueueService,
    AgentsProcessor,
    A2AService,
    LegalAgentService,
    FinanceAgentService,
    InvestorAgentService,
    CompetitorAgentService,
  ],
  exports: [AgentsService, OrchestratorService, AgentsQueueService, A2AService],
})
export class AgentsModule {}
