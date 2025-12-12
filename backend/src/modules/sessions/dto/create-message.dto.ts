import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsObject, MaxLength, MinLength, IsOptional } from 'class-validator';

export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export class CreateMessageDto {
  @ApiProperty({ enum: MESSAGE_ROLES })
  @IsString()
  @IsNotEmpty()
  @IsIn(MESSAGE_ROLES)
  role: MessageRole;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50000)
  content: string;

  @ApiPropertyOptional({ description: 'Agent that generated this message (optional for user messages)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  agent?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', default: {} })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
