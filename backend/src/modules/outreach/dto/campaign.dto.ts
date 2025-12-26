import { IsString, IsOptional, IsArray, IsBoolean, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CAMPAIGN_STATUSES, CampaignStatus } from '@/database/schema/outreach.schema';

export class CreateCampaignDto {
  @ApiProperty({ description: 'Campaign name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Email subject template with variables like {{companyName}}' })
  @IsString()
  @MaxLength(500)
  subjectTemplate: string;

  @ApiProperty({ description: 'Email body template with variables' })
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ description: 'Track email opens', default: true })
  @IsOptional()
  @IsBoolean()
  trackOpens?: boolean;

  @ApiPropertyOptional({ description: 'Track link clicks', default: true })
  @IsOptional()
  @IsBoolean()
  trackClicks?: boolean;

  @ApiPropertyOptional({ description: 'Daily sending limit', default: 50 })
  @IsOptional()
  dailyLimit?: number;
}

export class UpdateCampaignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subjectTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyTemplate?: string;

  @ApiPropertyOptional({ enum: CAMPAIGN_STATUSES })
  @IsOptional()
  @IsEnum(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackOpens?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackClicks?: boolean;
}

export class GenerateEmailsDto {
  @ApiProperty({ description: 'Lead IDs to generate emails for' })
  @IsArray()
  @IsUUID('4', { each: true })
  leadIds: string[];

  @ApiPropertyOptional({ description: 'Email tone', default: 'professional' })
  @IsOptional()
  @IsEnum(['professional', 'casual', 'friendly'])
  tone?: 'professional' | 'casual' | 'friendly';
}

export class GenerateTemplateDto {
  @ApiProperty({ description: 'Brief description of what you want to communicate' })
  @IsString()
  @MaxLength(1000)
  pitch: string;

  @ApiPropertyOptional({ description: 'Email tone', default: 'professional' })
  @IsOptional()
  @IsEnum(['professional', 'casual', 'friendly'])
  tone?: 'professional' | 'casual' | 'friendly';
}

export class CampaignResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subjectTemplate: string;

  @ApiProperty()
  bodyTemplate: string;

  @ApiProperty()
  status: CampaignStatus;

  @ApiProperty()
  settings: {
    trackOpens?: boolean;
    trackClicks?: boolean;
    dailyLimit?: number;
  };

  @ApiProperty()
  stats: {
    totalEmails?: number;
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
  };

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class CampaignEmailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  leadId: string;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  sentAt: string | null;

  @ApiPropertyOptional()
  openedAt: string | null;

  @ApiPropertyOptional()
  clickedAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class CampaignStatsDto {
  @ApiProperty()
  totalEmails: number;

  @ApiProperty()
  sent: number;

  @ApiProperty()
  delivered: number;

  @ApiProperty()
  opened: number;

  @ApiProperty()
  clicked: number;

  @ApiProperty()
  bounced: number;

  @ApiProperty()
  openRate: number;

  @ApiProperty()
  clickRate: number;

  @ApiProperty()
  bounceRate: number;
}

export class GeneratedTemplateDto {
  @ApiProperty()
  subjectTemplate: string;

  @ApiProperty()
  bodyTemplate: string;
}
