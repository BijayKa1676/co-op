import { IsString, IsBoolean, IsOptional, IsEnum, IsInt, Min, Max, IsUrl, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type InvestorStage = 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth';

export class CreateInvestorDto {
  @ApiProperty({ example: 'Sequoia Capital' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Leading venture capital firm' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://sequoiacap.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'] })
  @IsEnum(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'])
  stage: InvestorStage;

  @ApiProperty({ example: 'saas,fintech,ai', description: 'Comma-separated sectors' })
  @IsString()
  @MaxLength(500)
  sectors: string;

  @ApiPropertyOptional({ example: 1000, description: 'Minimum check size in thousands USD' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000000) // 10B max
  checkSizeMin?: number;

  @ApiPropertyOptional({ example: 50000, description: 'Maximum check size in thousands USD' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000000) // 10B max
  checkSizeMax?: number;

  @ApiProperty({ example: 'Menlo Park, CA' })
  @IsString()
  @MaxLength(255)
  location: string;

  @ApiPropertyOptional({ example: 'us,eu,apac', description: 'Comma-separated regions' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  regions?: string;

  @ApiPropertyOptional({ example: 'contact@sequoiacap.com' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/sequoia-capital' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/sequoia' })
  @IsOptional()
  @IsUrl()
  twitterUrl?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateInvestorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'] })
  @IsOptional()
  @IsEnum(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'])
  stage?: InvestorStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sectors?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000000)
  checkSizeMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000000)
  checkSizeMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  regions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  twitterUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class InvestorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string | null;

  @ApiProperty()
  website: string | null;

  @ApiProperty()
  logoUrl: string | null;

  @ApiProperty()
  stage: InvestorStage;

  @ApiProperty({ description: 'Comma-separated sectors' })
  sectors: string;

  @ApiProperty()
  checkSizeMin: number | null;

  @ApiProperty()
  checkSizeMax: number | null;

  @ApiProperty()
  location: string;

  @ApiProperty({ description: 'Comma-separated regions' })
  regions: string | null;

  @ApiProperty()
  contactEmail: string | null;

  @ApiProperty()
  linkedinUrl: string | null;

  @ApiProperty()
  twitterUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class InvestorQueryDto {
  @ApiPropertyOptional({ enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'] })
  @IsOptional()
  @IsEnum(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'])
  stage?: InvestorStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featuredOnly?: boolean;
}
