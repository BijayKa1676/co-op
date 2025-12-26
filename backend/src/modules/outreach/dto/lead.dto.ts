import { IsString, IsOptional, IsArray, IsNumber, IsEnum, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LEAD_STATUSES, LeadStatus } from '@/database/schema/outreach.schema';

export class DiscoverLeadsDto {
  @ApiProperty({ description: 'Description of your startup idea or product' })
  @IsString()
  @MaxLength(2000)
  startupIdea: string;

  @ApiPropertyOptional({ description: 'Target industry for leads' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetIndustry?: string;

  @ApiPropertyOptional({ description: 'Target company sizes', example: ['1-10', '11-50', '51-200'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCompanySizes?: string[];

  @ApiPropertyOptional({ description: 'Target locations', example: ['United States', 'Europe'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLocations?: string[];

  @ApiPropertyOptional({ description: 'Ideal customer profile description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  idealCustomerProfile?: string;

  @ApiPropertyOptional({ description: 'Maximum number of leads to discover', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(25)
  maxLeads?: number;
}

export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companySize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedinUrl?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES })
  @IsOptional()
  @IsEnum(LEAD_STATUSES)
  status?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  leadScore?: number;
}

export class LeadResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyName: string;

  @ApiPropertyOptional()
  website: string | null;

  @ApiPropertyOptional()
  industry: string | null;

  @ApiPropertyOptional()
  companySize: string | null;

  @ApiPropertyOptional()
  location: string | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  contactName: string | null;

  @ApiPropertyOptional()
  contactEmail: string | null;

  @ApiPropertyOptional()
  contactTitle: string | null;

  @ApiPropertyOptional()
  linkedinUrl: string | null;

  @ApiProperty()
  leadScore: number;

  @ApiProperty()
  status: LeadStatus;

  @ApiPropertyOptional()
  source: string | null;

  @ApiProperty()
  createdAt: string;
}

export class LeadFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LEAD_STATUSES })
  @IsOptional()
  @IsEnum(LEAD_STATUSES)
  status?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minScore?: number;
}
