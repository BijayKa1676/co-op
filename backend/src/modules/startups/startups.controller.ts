import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StartupsService } from './startups.service';
import { StartupResponseDto } from './dto';
import { AuthGuard } from '@/common/guards/auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { CurrentUser, CurrentUserPayload } from '@/common/decorators/current-user.decorator';
import { ApiResponseDto } from '@/common/dto/api-response.dto';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';

@ApiTags('Startups')
@Controller('startups')
@UseGuards(AuthGuard, UserThrottleGuard)
@ApiBearerAuth()
@RateLimit(RateLimitPresets.STANDARD) // Default: 100 req/min
export class StartupsController {
  constructor(private readonly startupsService: StartupsService) {}

  @Get()
  @UseGuards(AdminGuard)
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'List all startups (admin only)' })
  @ApiResponse({ status: 200, description: 'Startups list' })
  async findAll(): Promise<ApiResponseDto<StartupResponseDto[]>> {
    const startups = await this.startupsService.findAll();
    return ApiResponseDto.success(startups);
  }

  @Get('me')
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get current user startup - use GET /users/me instead' })
  @ApiResponse({ status: 403, description: 'Use GET /users/me to get your startup info' })
  getMyStartup(
    @CurrentUser() _user: CurrentUserPayload,
  ): ApiResponseDto<StartupResponseDto> {
    // User's startup info is included in GET /users/me response
    throw new ForbiddenException('Use GET /users/me to get your startup info');
  }

  @Get(':id')
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get startup by ID (own startup or admin)' })
  @ApiResponse({ status: 200, description: 'Startup found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Startup not found' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<StartupResponseDto>> {
    // Users can only view their own startup unless they're admin
    if (user.startupId !== id && user.role !== 'admin') {
      throw new ForbiddenException('You can only view your own startup');
    }
    const startup = await this.startupsService.findById(id);
    return ApiResponseDto.success(startup);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @RateLimit({ limit: 10, ttl: 60, keyPrefix: 'startups:delete' }) // 10 deletes per minute
  @ApiOperation({ summary: 'Delete startup (admin only)' })
  @ApiResponse({ status: 200, description: 'Startup deleted' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<null>> {
    await this.startupsService.delete(id);
    return ApiResponseDto.message('Startup deleted');
  }
}
