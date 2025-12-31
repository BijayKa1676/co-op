import { IsString, IsArray, IsBoolean, IsOptional, IsEnum, MaxLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type AlertType = 'competitor' | 'market' | 'news' | 'funding';
export type AlertFrequency = 'realtime' | 'daily' | 'weekly';

export class CreateAlertDto {
  @ApiProperty({ description: 'Alert name', example: 'Competitor News' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: ['competitor', 'market', 'news', 'funding'], default: 'competitor' })
  @IsOptional()
  @IsEnum(['competitor', 'market', 'news', 'funding'])
  type?: AlertType;

  @ApiProperty({ description: 'Keywords to monitor (1-10)', example: ['AI startup', 'Series A'] })
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords: string[];

  @ApiPropertyOptional({ description: 'Competitor names to monitor (max 10)', example: ['Acme Inc', 'TechCorp'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  competitors?: string[];

  @ApiPropertyOptional({ enum: ['realtime', 'daily', 'weekly'], default: 'daily' })
  @IsOptional()
  @IsEnum(['realtime', 'daily', 'weekly'])
  frequency?: AlertFrequency;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  emailNotify?: boolean;
}

export class UpdateAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  competitors?: string[];

  @ApiPropertyOptional({ enum: ['realtime', 'daily', 'weekly'] })
  @IsOptional()
  @IsEnum(['realtime', 'daily', 'weekly'])
  frequency?: AlertFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotify?: boolean;
}

export class AlertResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: AlertType;

  @ApiProperty()
  keywords: string[];

  @ApiProperty()
  competitors: string[];

  @ApiProperty()
  frequency: AlertFrequency;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  emailNotify: boolean;

  @ApiProperty()
  lastCheckedAt: string | null;

  @ApiProperty()
  lastTriggeredAt: string | null;

  @ApiProperty()
  triggerCount: number;

  @ApiProperty()
  createdAt: string;
}

export class AlertResultResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  alertId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty()
  source: string | null;

  @ApiProperty()
  sourceUrl: string | null;

  @ApiProperty()
  relevanceScore: number | null;

  @ApiProperty()
  matchedKeywords: string[];

  @ApiProperty()
  matchedCompetitor: string | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: string;
}
