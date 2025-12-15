import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, ApiKeyResponseDto, ApiKeyCreatedResponseDto } from './dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(AuthGuard, UserThrottleGuard)
@ApiBearerAuth()
@RateLimit(RateLimitPresets.STANDARD) // Default: 100 req/min for the controller
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RateLimit({ limit: 5, ttl: 60, keyPrefix: 'api-keys:create' }) // Strict: 5 creates per minute
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiResponseDto<ApiKeyCreatedResponseDto>> {
    const apiKey = await this.apiKeysService.create(user.id, dto);
    return ApiResponseDto.success(apiKey, 'API key created. Save the key now - it will not be shown again.');
  }

  @Get()
  @RateLimit(RateLimitPresets.READ) // Relaxed: 200 req/min for reads
  @ApiOperation({ summary: 'List all API keys for current user' })
  @ApiResponse({ status: 200, description: 'API keys list' })
  async findAll(@CurrentUser() user: CurrentUserPayload): Promise<ApiResponseDto<ApiKeyResponseDto[]>> {
    const keys = await this.apiKeysService.findByUser(user.id);
    return ApiResponseDto.success(keys);
  }

  @Delete(':id')
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'api-keys:revoke' }) // 10 revokes per minute
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<null>> {
    await this.apiKeysService.revoke(user.id, id);
    return ApiResponseDto.message('API key revoked');
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get API key usage summary for current user' })
  @ApiResponse({ status: 200, description: 'Usage summary' })
  async getUsageSummary(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponseDto<import('./api-keys.service').UserApiKeyUsageSummary>> {
    const usage = await this.apiKeysService.getUserUsageSummary(user.id);
    return ApiResponseDto.success(usage);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get usage stats for a specific API key' })
  @ApiResponse({ status: 200, description: 'Key usage stats' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getKeyUsage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ApiResponseDto<import('./api-keys.service').ApiKeyUsageStats>> {
    const usage = await this.apiKeysService.getKeyUsage(id, user.id);
    if (!usage) {
      throw new Error('API key not found');
    }
    return ApiResponseDto.success(usage);
  }
}
