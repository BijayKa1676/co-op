import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsArray, IsBoolean, MaxLength, IsIn, Matches } from 'class-validator';
import { VALID_WEBHOOK_EVENTS } from './create-webhook.dto';

export class UpdateWebhookDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Matches(/^[\w\s\-_.]+$/, { message: 'Invalid characters in name' })
  name?: string;

  @ApiProperty({ required: false })
  @IsUrl()
  @IsOptional()
  @MaxLength(2048)
  url?: string;

  @ApiProperty({ type: [String], required: false, enum: VALID_WEBHOOK_EVENTS })
  @IsArray()
  @IsString({ each: true })
  @IsIn(VALID_WEBHOOK_EVENTS, { each: true })
  @IsOptional()
  events?: string[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
