import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';

/**
 * Module for AI-powered insights generation
 *
 * Provides a unified service for generating LLM-powered insights
 * that can be used by any tool in the application.
 *
 * The InsightsService uses the global LlmModule providers (LlmRouterService)
 * which are available application-wide due to @Global() decorator.
 *
 * @example
 * // In a controller or service
 * constructor(private readonly insightsService: InsightsService) {}
 *
 * const insights = await this.insightsService.generateInsights({
 *   toolName: 'Runway Calculator',
 *   data: { cashBalance: 500000, monthlyBurn: 50000 },
 * });
 */
@Module({
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
