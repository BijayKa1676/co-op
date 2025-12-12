import { IsString, IsArray, MinLength, MaxLength, ArrayNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const VALID_SCOPES = [
  'read',
  'write',
  'admin',
  'agents',
  'agents:read',
  'agents:write',
  'sessions',
  'sessions:read',
  'sessions:write',
  'webhooks',
  'webhooks:read',
  'webhooks:write',
  'users:read',
  'startups:read',
  'notion',
  'mcp',
  '*',
] as const;
export type ApiKeyScope = (typeof VALID_SCOPES)[number];

export class CreateApiKeyDto {
  @ApiProperty({ description: 'API key name', example: 'Production API Key' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Scopes/permissions',
    example: ['agents:read', 'agents:write', 'sessions:read'],
    enum: VALID_SCOPES,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(VALID_SCOPES, { each: true })
  scopes: ApiKeyScope[];
}
