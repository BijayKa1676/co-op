import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, IsEnum } from 'class-validator';

export class SearchPagesDto {
  @ApiProperty({ description: 'Search query for page titles' })
  @IsString()
  @IsNotEmpty()
  query: string;
}

export class ExportToNotionDto {
  @ApiPropertyOptional({ description: 'Target page ID (uses default if not provided)' })
  @IsString()
  @IsOptional()
  pageId?: string;

  @ApiProperty({ description: 'Title for the exported page' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Agent type that generated the content', enum: ['legal', 'finance', 'investor', 'competitor'] })
  @IsEnum(['legal', 'finance', 'investor', 'competitor'])
  agentType: string;

  @ApiProperty({ description: 'Main content to export' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'Source URLs/references', type: [String] })
  @IsArray()
  @IsString({ each: true })
  sources: string[];

  @ApiProperty({ description: 'Additional metadata', type: Object })
  @IsObject()
  metadata: Record<string, unknown>;
}

export class NotionIntegrationStatusDto {
  @ApiProperty({ description: 'Whether Notion is connected' })
  connected: boolean;

  @ApiProperty({ description: 'Workspace name', nullable: true })
  workspaceName: string | null;

  @ApiProperty({ description: 'Workspace icon URL', nullable: true })
  workspaceIcon: string | null;

  @ApiProperty({ description: 'Default export page ID', nullable: true })
  defaultPageId: string | null;
}

export class NotionPageDto {
  @ApiProperty({ description: 'Page ID' })
  id: string;

  @ApiProperty({ description: 'Page title' })
  title: string;

  @ApiProperty({ description: 'Page URL' })
  url: string;

  @ApiProperty({ description: 'Last edited timestamp' })
  lastEditedTime: string;
}

export class NotionExportResultDto {
  @ApiProperty({ description: 'Created page ID' })
  pageId: string;

  @ApiProperty({ description: 'Created page URL' })
  pageUrl: string;

  @ApiProperty({ description: 'Page title' })
  title: string;

  @ApiProperty({ description: 'Export timestamp' })
  exportedAt: Date;
}
