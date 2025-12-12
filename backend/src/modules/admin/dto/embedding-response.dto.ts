import { ApiProperty } from '@nestjs/swagger';

export class EmbeddingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['pending', 'processing', 'completed', 'failed'] })
  status: string;

  @ApiProperty()
  chunksCreated: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false, nullable: true })
  completedAt?: Date;

  @ApiProperty({ required: false, nullable: true })
  error?: string;
}
