import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, IsOptional, IsNumber, IsEnum, IsDateString, 
  ValidateNested, Min, Max, MaxLength 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShareholderType, RoundType, RoundStatus } from '@/database/schema/cap-tables.schema';

// ============================================
// CAP TABLE DTOs
// ============================================

export class CreateCapTableDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  companyName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  incorporationDate?: string;

  @ApiPropertyOptional({ default: 10000000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  authorizedShares?: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}

export class UpdateCapTableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentValuation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionsPoolSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  authorizedShares?: number;
}

export class CapTableResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  incorporationDate?: string;

  @ApiProperty()
  authorizedShares: number;

  @ApiProperty()
  totalIssuedShares: number;

  @ApiProperty()
  fullyDilutedShares: number;

  @ApiPropertyOptional()
  currentValuation?: number;

  @ApiPropertyOptional()
  pricePerShare?: number;

  @ApiProperty()
  optionsPoolSize: number;

  @ApiProperty()
  optionsPoolAllocated: number;

  @ApiProperty()
  optionsPoolAvailable: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

// ============================================
// SHAREHOLDER DTOs
// ============================================

export class CreateShareholderDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ enum: ['founder', 'employee', 'investor', 'advisor', 'other'] })
  @IsEnum(['founder', 'employee', 'investor', 'advisor', 'other'])
  shareholderType: ShareholderType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commonShares?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  preferredShares?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionsGranted?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  vestingStartDate?: string;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(48)
  vestingCliffMonths?: number;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  vestingTotalMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  investmentAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  investmentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sharePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateShareholderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  commonShares?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  preferredShares?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionsGranted?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionsVested?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  optionsExercised?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ShareholderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  shareholderType: string;

  @ApiProperty()
  commonShares: number;

  @ApiProperty()
  preferredShares: number;

  @ApiProperty()
  optionsGranted: number;

  @ApiProperty()
  optionsVested: number;

  @ApiProperty()
  optionsExercised: number;

  @ApiProperty({ description: 'Total shares (common + preferred + exercised options)' })
  totalShares: number;

  @ApiProperty({ description: 'Ownership percentage (fully diluted)' })
  ownershipPercent: number;

  @ApiPropertyOptional()
  vestingStartDate?: string;

  @ApiPropertyOptional()
  vestingCliffMonths?: number;

  @ApiPropertyOptional()
  vestingTotalMonths?: number;

  @ApiPropertyOptional()
  vestingProgress?: number; // 0-100%

  @ApiPropertyOptional()
  investmentAmount?: number;

  @ApiPropertyOptional()
  investmentDate?: string;

  @ApiPropertyOptional()
  sharePrice?: number;

  @ApiProperty()
  createdAt: string;
}

// ============================================
// FUNDING ROUND DTOs
// ============================================

export class CreateRoundDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ['equity', 'safe', 'convertible_note'] })
  @IsEnum(['equity', 'safe', 'convertible_note'])
  roundType: RoundType;

  @ApiPropertyOptional({ enum: ['planned', 'in_progress', 'closed'], default: 'planned' })
  @IsOptional()
  @IsEnum(['planned', 'in_progress', 'closed'])
  status?: RoundStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetRaise?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  preMoneyValuation?: number;

  @ApiPropertyOptional({ description: 'For SAFE/Convertible notes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valuationCap?: number;

  @ApiPropertyOptional({ description: 'Discount rate (e.g., 20 for 20%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @ApiPropertyOptional({ description: 'Interest rate for convertible notes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  roundDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRoundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ['planned', 'in_progress', 'closed'] })
  @IsOptional()
  @IsEnum(['planned', 'in_progress', 'closed'])
  status?: RoundStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountRaised?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  preMoneyValuation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  postMoneyValuation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerShare?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sharesIssued?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RoundResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  roundType: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  targetRaise?: number;

  @ApiPropertyOptional()
  amountRaised?: number;

  @ApiPropertyOptional()
  preMoneyValuation?: number;

  @ApiPropertyOptional()
  postMoneyValuation?: number;

  @ApiPropertyOptional()
  pricePerShare?: number;

  @ApiPropertyOptional()
  sharesIssued?: number;

  @ApiPropertyOptional()
  valuationCap?: number;

  @ApiPropertyOptional()
  discountRate?: number;

  @ApiPropertyOptional()
  interestRate?: number;

  @ApiPropertyOptional()
  roundDate?: string;

  @ApiPropertyOptional()
  closeDate?: string;

  @ApiProperty()
  createdAt: string;
}

// ============================================
// SCENARIO DTOs
// ============================================

export class NewRoundParametersDto {
  @ApiProperty({ description: 'Investment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Pre-money valuation' })
  @IsNumber()
  valuation: number;

  @ApiProperty({ enum: ['equity', 'safe', 'convertible_note'] })
  @IsEnum(['equity', 'safe', 'convertible_note'])
  type: RoundType;
}

export class ScenarioParametersDto {
  @ApiPropertyOptional({ description: 'New funding round parameters' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewRoundParametersDto)
  newRound?: NewRoundParametersDto;

  @ApiPropertyOptional({ description: 'Options pool increase in shares' })
  @IsOptional()
  @IsNumber()
  optionsPoolIncrease?: number;
}

export class CreateScenarioDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Scenario parameters for what-if modeling' })
  @ValidateNested()
  @Type(() => ScenarioParametersDto)
  parameters: ScenarioParametersDto;
}

export class ScenarioResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  parameters: ScenarioParametersDto;

  @ApiProperty({ description: 'Calculated results showing dilution impact' })
  results: {
    dilution: Record<string, { before: number; after: number }>;
    newOwnership: Record<string, number>;
    founderDilution: number;
    newInvestorOwnership: number;
    postMoneyValuation: number;
  };

  @ApiProperty()
  isFavorite: boolean;

  @ApiProperty()
  createdAt: string;
}

// ============================================
// EXPORT DTOs
// ============================================

export class ExportCapTableDto {
  @ApiProperty({ enum: ['json', 'csv', 'carta'] })
  @IsEnum(['json', 'csv', 'carta'])
  format: 'json' | 'csv' | 'carta';
}

export class ExportResponseDto {
  @ApiProperty()
  content: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mimeType: string;
}

// ============================================
// SUMMARY DTOs
// ============================================

export class CapTableSummaryDto {
  @ApiProperty()
  capTable: CapTableResponseDto;

  @ApiProperty({ type: [ShareholderResponseDto] })
  shareholders: ShareholderResponseDto[];

  @ApiProperty({ type: [RoundResponseDto] })
  rounds: RoundResponseDto[];

  @ApiProperty({ description: 'Ownership breakdown by type' })
  ownershipByType: {
    founders: number;
    employees: number;
    investors: number;
    advisors: number;
    optionsPool: number;
  };
}
