import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { InvestorType, PitchDeckAnalysis, SlideAnalysis } from '@/database/schema/pitch-decks.schema';

export class UploadPitchDeckDto {
  @ApiPropertyOptional({ description: 'Target investor type for tailored analysis' })
  @IsOptional()
  @IsEnum(['vc', 'angel', 'corporate'])
  investorType?: InvestorType;

  @ApiPropertyOptional({ description: 'Target raise amount (e.g., "$500K-$1M")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetRaise?: string;
}

export class PitchDeckResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  pageCount: number;

  @ApiProperty({ enum: ['pending', 'analyzing', 'completed', 'failed'] })
  status: string;

  @ApiPropertyOptional()
  investorType?: string;

  @ApiPropertyOptional()
  targetRaise?: string;

  @ApiPropertyOptional()
  analysis?: PitchDeckAnalysis;

  @ApiProperty()
  createdAt: string;

  @ApiPropertyOptional()
  analyzedAt?: string;
}

export class PitchDeckListResponseDto {
  @ApiProperty({ type: [PitchDeckResponseDto] })
  decks: PitchDeckResponseDto[];

  @ApiProperty()
  total: number;
}

export class GenerateInvestorVersionDto {
  @ApiProperty({ description: 'Pitch deck ID to generate version from' })
  @IsUUID()
  pitchDeckId: string;

  @ApiProperty({ enum: ['vc', 'angel', 'corporate'], description: 'Target investor type' })
  @IsEnum(['vc', 'angel', 'corporate'])
  investorType: InvestorType;
}

export class InvestorVersionResponseDto {
  @ApiProperty({ description: 'Tailored suggestions for this investor type' })
  suggestions: string[];

  @ApiProperty({ description: 'Key points to emphasize' })
  emphasize: string[];

  @ApiProperty({ description: 'Points to de-emphasize or remove' })
  deemphasize: string[];

  @ApiProperty({ description: 'Recommended slide order' })
  recommendedOrder: string[];

  @ApiProperty({ description: 'Fit score for this investor type (0-100)' })
  fitScore: number;
}

export class SectorBenchmarkDto {
  @ApiProperty({ description: 'Sector to benchmark against' })
  @IsString()
  sector: string;
}

export class BenchmarkResponseDto {
  @ApiProperty()
  sector: string;

  @ApiProperty({ description: 'Your deck score' })
  yourScore: number;

  @ApiProperty({ description: 'Average score in sector' })
  sectorAverage: number;

  @ApiProperty({ description: 'Top 10% score in sector' })
  topDecksScore: number;

  @ApiProperty({ description: 'Your percentile ranking' })
  percentile: number;

  @ApiProperty({ description: 'Areas where you beat the average' })
  aboveAverage: string[];

  @ApiProperty({ description: 'Areas where you are below average' })
  belowAverage: string[];
}
