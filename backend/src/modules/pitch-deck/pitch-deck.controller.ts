import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { UserThrottleGuard } from '@/common/guards/user-throttle.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RateLimit, RateLimitPresets } from '@/common/decorators/rate-limit.decorator';
import { PitchDeckService } from './pitch-deck.service';
import {
  UploadPitchDeckDto,
  PitchDeckResponseDto,
  GenerateInvestorVersionDto,
  InvestorVersionResponseDto,
  SectorBenchmarkDto,
  BenchmarkResponseDto,
} from './dto/pitch-deck.dto';
import { InvestorType } from '@/database/schema/pitch-decks.schema';

@ApiTags('Pitch Deck')
@Controller('pitch-decks')
@UseGuards(AuthGuard, UserThrottleGuard)
@ApiBearerAuth()
export class PitchDeckController {
  constructor(private readonly pitchDeckService: PitchDeckService) {}

  @Post('upload')
  @RateLimit({ limit: 5, ttl: 3600, keyPrefix: 'pitch-deck:upload' }) // 5 uploads per hour
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload and analyze a pitch deck' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        investorType: { type: 'string', enum: ['vc', 'angel', 'corporate'] },
        targetRaise: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Pitch deck uploaded and analysis started' })
  async upload(
    @CurrentUser('id') userId: string,
    @CurrentUser('startupId') startupId: string | null,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadPitchDeckDto,
  ) {
    return this.pitchDeckService.uploadAndAnalyze(
      userId,
      startupId,
      file,
      dto.investorType as InvestorType,
      dto.targetRaise,
    );
  }

  @Get()
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'List all pitch decks' })
  @ApiResponse({ status: 200, type: [PitchDeckResponseDto] })
  async findAll(@CurrentUser('id') userId: string) {
    const decks = await this.pitchDeckService.findAll(userId);
    return decks.map((d) => this.toResponse(d));
  }

  @Get(':id')
  @RateLimit(RateLimitPresets.READ)
  @ApiOperation({ summary: 'Get pitch deck by ID' })
  @ApiResponse({ status: 200, type: PitchDeckResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    const deck = await this.pitchDeckService.findOne(id, userId);
    return this.toResponse(deck);
  }

  @Post(':id/investor-version')
  @RateLimit({ limit: 10, ttl: 3600, keyPrefix: 'pitch-deck:investor-version' })
  @ApiOperation({ summary: 'Generate investor-specific version recommendations' })
  @ApiResponse({ status: 200, type: InvestorVersionResponseDto })
  async generateInvestorVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: GenerateInvestorVersionDto,
  ) {
    return this.pitchDeckService.generateInvestorVersion(id, userId, dto.investorType);
  }

  @Post(':id/benchmark')
  @RateLimit({ limit: 10, ttl: 3600, keyPrefix: 'pitch-deck:benchmark' })
  @ApiOperation({ summary: 'Get sector benchmark comparison' })
  @ApiResponse({ status: 200, type: BenchmarkResponseDto })
  async getSectorBenchmark(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SectorBenchmarkDto,
  ) {
    return this.pitchDeckService.getSectorBenchmark(id, userId, dto.sector);
  }

  @Delete(':id')
  @RateLimit(RateLimitPresets.STANDARD)
  @ApiOperation({ summary: 'Delete a pitch deck' })
  @ApiResponse({ status: 204, description: 'Pitch deck deleted' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.pitchDeckService.delete(id, userId);
  }

  private toResponse(deck: any): PitchDeckResponseDto {
    return {
      id: deck.id,
      filename: deck.filename,
      originalName: deck.originalName,
      fileSize: deck.fileSize,
      pageCount: deck.pageCount || 0,
      status: deck.status,
      investorType: deck.investorType || undefined,
      targetRaise: deck.targetRaise || undefined,
      analysis: deck.analysis || undefined,
      createdAt: deck.createdAt.toISOString(),
      analyzedAt: deck.analyzedAt?.toISOString() || undefined,
    };
  }
}
