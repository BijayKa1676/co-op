import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { RAG_DOMAINS, RAG_SECTORS, RagDomain, RagSector } from './upload-pdf.dto';

export class ListEmbeddingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ 
    description: 'Filter by domain',
    enum: ['legal', 'finance'],
    example: 'legal',
  })
  @IsOptional()
  @IsIn(RAG_DOMAINS)
  @Transform(({ value }: { value: string }) => value?.toLowerCase())
  domain?: RagDomain;

  @ApiPropertyOptional({ 
    description: 'Filter by sector',
    enum: ['fintech', 'greentech', 'healthtech', 'saas', 'ecommerce'],
    example: 'fintech',
  })
  @IsOptional()
  @IsIn(RAG_SECTORS)
  @Transform(({ value }: { value: string }) => value?.toLowerCase())
  sector?: RagSector;
}
