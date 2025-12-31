import { ApiProperty } from '@nestjs/swagger';

/**
 * Individual insight item
 */
export class InsightItemDto {
  @ApiProperty({
    description: 'Type of insight',
    enum: ['tip', 'warning', 'action', 'success'],
    example: 'warning',
  })
  type: 'tip' | 'warning' | 'action' | 'success';

  @ApiProperty({
    description: 'Insight message',
    example: 'Your runway is below 6 months - consider fundraising soon',
  })
  message: string;
}

/**
 * Response DTO for AI insights
 */
export class InsightsResponseDto {
  @ApiProperty({
    description: 'Array of generated insights',
    type: [InsightItemDto],
  })
  insights: InsightItemDto[];

  @ApiProperty({
    description: 'ISO timestamp when insights were generated',
    example: '2024-01-15T10:30:00.000Z',
  })
  generatedAt: string;
}
