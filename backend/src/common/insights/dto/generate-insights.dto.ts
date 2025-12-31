import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * User context for personalized insights
 */
export class InsightUserContextDto {
  @ApiPropertyOptional({ description: 'Company name', example: 'Acme Inc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Industry/sector', example: 'fintech' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @ApiPropertyOptional({ description: 'Company stage', example: 'seed' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  stage?: string;

  @ApiPropertyOptional({ description: 'Country/location', example: 'United States' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;
}

/**
 * Request DTO for generating AI insights
 */
export class GenerateInsightsDto {
  @ApiProperty({
    description: 'Name of the tool requesting insights',
    example: 'Runway Calculator',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  toolName: string;

  @ApiProperty({
    description: 'Tool-specific data to analyze',
    example: { cashBalance: 500000, monthlyBurn: 50000, runwayMonths: 10 },
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional user/company context for personalized insights',
    type: InsightUserContextDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InsightUserContextDto)
  userContext?: InsightUserContextDto;
}
