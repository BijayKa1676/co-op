import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { NotionService } from './notion.service';
import {
  SearchPagesDto,
  ExportToNotionDto,
  NotionIntegrationStatusDto,
  NotionPageDto,
  NotionExportResultDto,
} from './dto/notion.dto';

/**
 * Notion Integration Controller
 * 
 * Uses internal Notion integration (admin-configured API token).
 * No OAuth flow needed - just set NOTION_API_TOKEN in environment.
 * 
 * Setup:
 * 1. Create integration at https://www.notion.so/my-integrations
 * 2. Set NOTION_API_TOKEN in .env
 * 3. Share target pages with your integration in Notion UI
 * 4. Optionally set NOTION_DEFAULT_PAGE_ID for default export location
 */
@ApiTags('Notion')
@Controller('notion')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class NotionController {
  constructor(private readonly notionService: NotionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get Notion integration status' })
  @ApiResponse({ status: 200, type: NotionIntegrationStatusDto })
  async getStatus(): Promise<NotionIntegrationStatusDto> {
    return this.notionService.getIntegrationStatus();
  }

  @Get('pages')
  @ApiOperation({ summary: 'Search Notion pages shared with integration' })
  @ApiResponse({ status: 200, type: [NotionPageDto] })
  async searchPages(@Query() dto: SearchPagesDto): Promise<NotionPageDto[]> {
    const pages = await this.notionService.searchPages(dto.query);
    return pages.map((page) => ({
      id: page.id,
      title: this.extractPageTitle(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
    }));
  }

  @Post('export')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Export agent output to Notion page' })
  @ApiResponse({ status: 201, type: NotionExportResultDto })
  async exportToNotion(@Body() dto: ExportToNotionDto): Promise<NotionExportResultDto> {
    return this.notionService.exportToNotion({
      pageId: dto.pageId ?? '',
      title: dto.title,
      agentType: dto.agentType,
      content: dto.content,
      sources: dto.sources,
      metadata: dto.metadata,
    });
  }

  private extractPageTitle(page: { properties: Record<string, { title?: { plain_text: string }[] }> }): string {
    const titleProp = page.properties.title ?? page.properties.Name ?? page.properties.name;
    if (titleProp?.title && titleProp.title.length > 0) {
      return titleProp.title.map((t) => t.plain_text).join('');
    }
    return 'Untitled';
  }
}
