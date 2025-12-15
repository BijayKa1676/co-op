import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto, WebhookResponseDto } from './dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(AuthGuard, UserThrottleGuard)
@ApiBearerAuth()
@RateLimit(RateLimitPresets.STANDARD) // Default: 100 req/min
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @RateLimit({ limit: 5, ttl: 60, keyPrefix: 'webhooks:create' }) // Strict: 5 creates per minute
  @ApiOperation({ summary: 'Create a webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWebhookDto,
  ): Promise<ApiResponseDto<WebhookResponseDto>> {
    const webhook = await this.webhooksService.create(user.id, dto);
    return ApiResponseDto.success(webhook, 'Webhook created');
  }

  @Get()
  @RateLimit(RateLimitPresets.READ) // Relaxed: 200 req/min for reads
  @ApiOperation({ summary: 'List all webhooks' })
  @ApiResponse({ status: 200, description: 'Webhooks list' })
  async findAll(@CurrentUser() user: CurrentUserPayload): Promise<ApiResponseDto<WebhookResponseDto[]>> {
    const webhooks = await this.webhooksService.findByUserId(user.id);
    return ApiResponseDto.success(webhooks);
  }

  @Get(':id')
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook found' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<WebhookResponseDto>> {
    const webhook = await this.webhooksService.findById(id, user.id);
    return ApiResponseDto.success(webhook);
  }

  @Patch(':id')
  @RateLimit({ limit: 20, ttl: 60, keyPrefix: 'webhooks:update' }) // 20 updates per minute
  @ApiOperation({ summary: 'Update webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<ApiResponseDto<WebhookResponseDto>> {
    const webhook = await this.webhooksService.update(id, user.id, dto);
    return ApiResponseDto.success(webhook, 'Webhook updated');
  }

  @Delete(':id')
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'webhooks:delete' }) // 10 deletes per minute
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.webhooksService.delete(id, user.id);
    return ApiResponseDto.message('Webhook deleted');
  }

  @Post(':id/regenerate-secret')
  @RateLimit({ limit: 3, ttl: 60, keyPrefix: 'webhooks:regenerate' }) // Very strict: 3 per minute
  @ApiOperation({ summary: 'Regenerate webhook secret' })
  @ApiResponse({ status: 200, description: 'Secret regenerated' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async regenerateSecret(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<{ secret: string }>> {
    const result = await this.webhooksService.regenerateSecret(id, user.id);
    return ApiResponseDto.success(result, 'Secret regenerated');
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get webhook usage summary for current user' })
  @ApiResponse({ status: 200, description: 'Usage summary' })
  async getUsageSummary(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseDto<import('./webhooks.service').UserWebhookUsageSummary>> {
    const usage = await this.webhooksService.getUserUsageSummary(user.id);
    return ApiResponseDto.success(usage);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get usage stats for a specific webhook' })
  @ApiResponse({ status: 200, description: 'Webhook usage stats' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getWebhookUsage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<import('./webhooks.service').WebhookUsageStats>> {
    const usage = await this.webhooksService.getWebhookUsage(id, user.id);
    if (!usage) {
      throw new Error('Webhook not found');
    }
    return ApiResponseDto.success(usage);
  }
}
