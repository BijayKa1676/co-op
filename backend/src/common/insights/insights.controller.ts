import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { RateLimit } from '@/common/decorators/rate-limit.decorator';
import { InsightsService } from './insights.service';
import { GenerateInsightsDto } from './dto/generate-insights.dto';
import { InsightsResponseDto } from './dto/insights-response.dto';
import { InsightContext } from './insights.types';

/**
 * Controller for AI-powered insights generation
 * Provides a unified endpoint for all tools to get LLM-generated insights
 */
@ApiTags('AI Insights')
@Controller('insights')
@UseGuards(AuthGuard, UserThrottleGuard)
@ApiBearerAuth()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  /**
   * Generate AI-powered insights for any tool
   * Analyzes provided data and returns actionable recommendations
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 30, ttl: 60, keyPrefix: 'insights:generate' })
  @ApiOperation({
    summary: 'Generate AI-powered insights',
    description:
      'Analyzes tool-specific data and generates actionable insights using LLM. ' +
      'Returns 2-4 insights categorized as tips, warnings, actions, or successes.',
  })
  @ApiBody({ type: GenerateInsightsDto })
  @ApiResponse({
    status: 200,
    description: 'Insights generated successfully',
    type: InsightsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid authentication required',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - max 30 requests per minute',
  })
  async generateInsights(
    @Body() dto: GenerateInsightsDto,
  ): Promise<InsightsResponseDto> {
    const context: InsightContext = {
      toolName: dto.toolName,
      data: dto.data,
      userContext: dto.userContext,
    };

    return this.insightsService.generateInsights(context);
  }
}
