import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';
import { LeadsService } from './leads.service';
import {
  DiscoverLeadsDto,
  CreateLeadDto,
  UpdateLeadDto,
  LeadResponseDto,
  LeadFiltersDto,
} from './dto/lead.dto';

@ApiTags('Outreach - Leads')
@ApiBearerAuth()
@Controller('outreach/leads')
@UseGuards(AuthGuard, UserThrottleGuard)
@RateLimit(RateLimitPresets.STANDARD) // Default: 100 req/min
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('discover')
  @RateLimit({ limit: 5, ttl: 3600 }) // 5 per hour
  @ApiOperation({ summary: 'Discover potential leads using AI-powered web research' })
  async discover(
    @CurrentUser('id') userId: string,
    @CurrentUser('startupId') startupId: string | null,
    @Body() dto: DiscoverLeadsDto,
  ): Promise<LeadResponseDto[]> {
    if (!startupId) {
      throw new BadRequestException('Startup not found. Please complete onboarding first.');
    }
    return this.leadsService.discoverLeads(userId, startupId, dto);
  }

  @Post()
  @RateLimit(RateLimitPresets.CREATE)
  @ApiOperation({ summary: 'Create a lead manually' })
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('startupId') startupId: string | null,
    @Body() dto: CreateLeadDto,
  ): Promise<LeadResponseDto> {
    if (!startupId) {
      throw new BadRequestException('Startup not found. Please complete onboarding first.');
    }
    return this.leadsService.create(userId, startupId, dto);
  }

  @Get()
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get all leads for current user' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'industry', required: false })
  @ApiQuery({ name: 'minScore', required: false, type: Number })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() filters: LeadFiltersDto,
  ): Promise<LeadResponseDto[]> {
    return this.leadsService.findAll(userId, filters);
  }

  @Get(':id')
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get a specific lead' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) leadId: string,
  ): Promise<LeadResponseDto> {
    return this.leadsService.findOne(userId, leadId);
  }

  @Patch(':id')
  @RateLimit(RateLimitPresets.STANDARD)
  @ApiOperation({ summary: 'Update a lead' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.update(userId, leadId, dto);
  }

  @Delete(':id')
  @RateLimit(RateLimitPresets.STANDARD)
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) leadId: string,
  ): Promise<{ success: boolean }> {
    await this.leadsService.delete(userId, leadId);
    return { success: true };
  }
}
