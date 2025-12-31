import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '@/common/llm/llm-router.service';
import { sanitizeResponse } from '@/common/llm/utils/response-sanitizer';
import {
  InsightContext,
  InsightResult,
  InsightItem,
  InsightType,
  VALID_INSIGHT_TYPES,
  MAX_INSIGHTS,
  MAX_MESSAGE_LENGTH,
} from './insights.types';

const INSIGHT_SYSTEM_PROMPT = `You are an AI advisor for startup founders. Generate 2-4 brief, actionable insights based on the provided data.

OUTPUT FORMAT (JSON only):
{
  "insights": [
    { "type": "tip|warning|action|success", "message": "Brief insight (max 100 chars)" }
  ]
}

RULES:
- tip: General advice or best practice
- warning: Potential risk or concern
- action: Specific action the user should take
- success: Positive observation or achievement
- Be specific to the data provided
- Keep messages concise and actionable
- Maximum 4 insights
- Return ONLY valid JSON, no markdown`;

/**
 * Service for generating AI-powered insights for various tools
 * Uses LLM to analyze tool data and provide actionable recommendations
 */
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly llmRouter: LlmRouterService) {}

  /**
   * Generate AI-powered insights based on tool data
   * @param context - Tool name, data, and optional user context
   * @returns Array of insights with types and messages
   */
  async generateInsights(context: InsightContext): Promise<InsightResult> {
    const prompt = this.buildPrompt(context);

    try {
      const result = await this.llmRouter.chatForPhase(
        'draft',
        [
          { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        {
          temperature: 0.7,
          maxTokens: 400,
        },
      );

      const parsed = this.parseInsights(result.content);

      this.logger.debug(
        `Generated ${parsed.length} insights for ${context.toolName}`,
      );

      return {
        insights: parsed,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate insights for ${context.toolName}`,
        error instanceof Error ? error.stack : error,
      );

      // Return empty insights on error - don't break the UI
      return {
        insights: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Build the prompt for the LLM based on context
   */
  private buildPrompt(context: InsightContext): string {
    const parts: string[] = [];

    parts.push(`Tool: ${context.toolName}`);

    if (context.userContext) {
      const { companyName, industry, stage, country } = context.userContext;
      if (companyName) parts.push(`Company: ${companyName}`);
      if (industry) parts.push(`Industry: ${industry}`);
      if (stage) parts.push(`Stage: ${stage}`);
      if (country) parts.push(`Location: ${country}`);
    }

    // Limit data size to prevent token overflow
    const dataStr = JSON.stringify(context.data, null, 2);
    const truncatedData =
      dataStr.length > 2000 ? dataStr.slice(0, 2000) + '...' : dataStr;

    parts.push(`\nData:\n${truncatedData}`);
    parts.push('\nGenerate insights based on this data:');

    return parts.join('\n');
  }

  /**
   * Parse and validate insights from LLM response
   */
  private parseInsights(content: string): InsightItem[] {
    try {
      // Clean up the response
      let cleaned = sanitizeResponse(content);

      // Try to extract JSON from the response
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = jsonRegex.exec(cleaned);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned) as { insights?: unknown[] };

      if (!Array.isArray(parsed.insights)) {
        this.logger.warn('Insights response missing insights array');
        return [];
      }

      return parsed.insights
        .filter((item): item is { type: string; message: string } =>
          this.isValidInsight(item),
        )
        .map((item) => this.normalizeInsight(item))
        .slice(0, MAX_INSIGHTS);
    } catch (error) {
      this.logger.warn(
        'Failed to parse insights JSON',
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }

  /**
   * Type guard to validate insight structure
   */
  private isValidInsight(item: unknown): item is { type: string; message: string } {
    return (
      typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      'message' in item &&
      typeof (item as Record<string, unknown>).type === 'string' &&
      typeof (item as Record<string, unknown>).message === 'string'
    );
  }

  /**
   * Normalize insight to ensure valid type and message length
   */
  private normalizeInsight(item: { type: string; message: string }): InsightItem {
    const type: InsightType = VALID_INSIGHT_TYPES.includes(item.type as InsightType)
      ? (item.type as InsightType)
      : 'tip';

    return {
      type,
      message: item.message.slice(0, MAX_MESSAGE_LENGTH),
    };
  }
}
