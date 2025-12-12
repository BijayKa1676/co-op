import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotionPage,
  NotionSearchResult,
  NotionBlock,
  ExportToNotionRequest,
  NotionExportResult,
  NotionIntegrationStatus,
} from './types/notion.types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

/**
 * Notion Integration Service
 * 
 * Uses INTERNAL integration (single API token) - no OAuth required.
 * 
 * Setup:
 * 1. Go to https://www.notion.so/my-integrations
 * 2. Create new integration (Internal)
 * 3. Copy the "Internal Integration Secret"
 * 4. Set NOTION_API_TOKEN in .env
 * 5. Share pages/databases with your integration in Notion
 */
@Injectable()
export class NotionService {
  private readonly logger = new Logger(NotionService.name);
  private readonly apiToken: string;
  private readonly defaultPageId: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('NOTION_API_TOKEN', '');
    this.defaultPageId = this.config.get<string>('NOTION_DEFAULT_PAGE_ID', '');
    this.isConfigured = Boolean(this.apiToken);

    if (!this.isConfigured) {
      this.logger.warn('Notion integration not configured - set NOTION_API_TOKEN');
    } else {
      this.logger.log('Notion integration configured (internal integration)');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  async getIntegrationStatus(): Promise<NotionIntegrationStatus> {
    if (!this.isConfigured) {
      return {
        connected: false,
        workspaceName: null,
        workspaceIcon: null,
        defaultPageId: null,
      };
    }

    // Verify token works by fetching user info
    try {
      const response = await this.notionRequest<{ bot: { workspace_name: string } }>(
        'GET',
        '/users/me',
      );

      return {
        connected: true,
        workspaceName: response.bot?.workspace_name ?? 'Connected',
        workspaceIcon: null,
        defaultPageId: this.defaultPageId || null,
      };
    } catch {
      return {
        connected: false,
        workspaceName: null,
        workspaceIcon: null,
        defaultPageId: null,
      };
    }
  }

  async searchPages(query: string): Promise<NotionPage[]> {
    if (!this.isConfigured) {
      throw new BadRequestException('Notion integration not configured');
    }

    const response = await this.notionRequest<NotionSearchResult>(
      'POST',
      '/search',
      {
        query,
        filter: { property: 'object', value: 'page' },
        page_size: 20,
      },
    );

    return response.results;
  }

  async exportToNotion(request: ExportToNotionRequest): Promise<NotionExportResult> {
    if (!this.isConfigured) {
      throw new BadRequestException('Notion integration not configured');
    }

    let pageId = request.pageId || this.defaultPageId;
    if (!pageId) {
      throw new BadRequestException('No page ID provided and no default page configured (set NOTION_DEFAULT_PAGE_ID)');
    }

    // Extract UUID from page ID (handles both formats):
    // - Full UUID: 29f7c332-efea-800a-9dc8-c8cea9ce584e
    // - Notion URL format: deck-29f7c332efea800a9dc8c8cea9ce584e
    // - Just the hex: 29f7c332efea800a9dc8c8cea9ce584e
    pageId = this.normalizePageId(pageId);

    // Create child page under the specified parent
    const blocks = this.formatContentToBlocks(request);

    const pageData = {
      parent: { page_id: pageId },
      properties: {
        title: {
          title: [{ text: { content: request.title } }],
        },
      },
      children: blocks,
    };

    const page = await this.notionRequest<NotionPage>(
      'POST',
      '/pages',
      pageData,
    );

    return {
      pageId: page.id,
      pageUrl: page.url,
      title: request.title,
      exportedAt: new Date(),
    };
  }

  private normalizePageId(pageId: string): string {
    // Remove any prefix like "deck-" or page name
    let id = pageId;

    // If it contains a dash followed by 32 hex chars, extract the hex part
    const slugMatch = /-([a-f0-9]{32})$/i.exec(id);
    if (slugMatch) {
      id = slugMatch[1];
    }

    // Remove all dashes to get raw hex
    const hex = id.replace(/-/g, '');

    // If it's 32 hex characters, format as UUID
    if (/^[a-f0-9]{32}$/i.test(hex)) {
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // Already a valid UUID format
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      return id;
    }

    // Return as-is and let Notion API handle the error
    return pageId;
  }

  async getPage(pageId: string): Promise<NotionPage> {
    if (!this.isConfigured) {
      throw new BadRequestException('Notion integration not configured');
    }

    return this.notionRequest<NotionPage>('GET', `/pages/${pageId}`);
  }

  private formatContentToBlocks(request: ExportToNotionRequest): NotionBlock[] {
    const blocks: NotionBlock[] = [];

    // Header with agent type and timestamp
    blocks.push(this.createCalloutBlock(
      `🤖 ${this.formatAgentType(request.agentType)} Analysis`,
      `Generated on ${new Date().toLocaleDateString()}`,
    ));

    blocks.push(this.createDividerBlock());

    // Main content - split into paragraphs
    const paragraphs = request.content.split('\n\n').filter(Boolean);
    for (const paragraph of paragraphs) {
      if (paragraph.startsWith('## ')) {
        // H2 heading
        blocks.push(this.createHeading2Block(paragraph.replace(/^##\s*/, '')));
      } else if (paragraph.startsWith('### ')) {
        // H3 heading
        blocks.push(this.createHeading3Block(paragraph.replace(/^###\s*/, '')));
      } else if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        // Bold heading (legacy format)
        blocks.push(this.createHeading2Block(paragraph.replace(/\*\*/g, '')));
      } else if (paragraph.startsWith('- ') || paragraph.startsWith('• ')) {
        // Bullet list
        const items = paragraph.split('\n').filter((line) => line.startsWith('- ') || line.startsWith('• '));
        for (const item of items) {
          blocks.push(this.createBulletBlock(item.replace(/^[-•]\s*/, '')));
        }
      } else if (/^\d+\.\s/.test(paragraph)) {
        // Numbered list
        const items = paragraph.split('\n').filter((line) => /^\d+\.\s/.test(line));
        for (const item of items) {
          blocks.push(this.createNumberedBlock(item.replace(/^\d+\.\s*/, '')));
        }
      } else {
        // Regular paragraph
        blocks.push(this.createParagraphBlock(paragraph));
      }
    }

    // Sources section
    if (request.sources.length > 0) {
      blocks.push(this.createDividerBlock());
      blocks.push(this.createHeading3Block('Sources'));
      for (const source of request.sources) {
        blocks.push(this.createBulletBlock(source, source.startsWith('http') ? source : undefined));
      }
    }

    // Metadata section
    if (Object.keys(request.metadata).length > 0) {
      blocks.push(this.createDividerBlock());
      blocks.push(this.createToggleBlock('Metadata', this.formatMetadataBlocks(request.metadata)));
    }

    return blocks;
  }

  private formatAgentType(agentType: string): string {
    const types: Record<string, string> = {
      legal: 'Legal',
      finance: 'Finance',
      investor: 'Investor Relations',
      competitor: 'Competitive Intelligence',
    };
    return types[agentType] ?? agentType;
  }

  private createCalloutBlock(title: string, body: string): NotionBlock {
    return {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [
          { type: 'text', text: { content: `${title}\n${body}` } },
        ],
        icon: { type: 'emoji', emoji: '📋' },
        color: 'blue_background',
      },
    };
  }

  private createDividerBlock(): NotionBlock {
    return { object: 'block', type: 'divider', divider: {} };
  }

  private createHeading2Block(text: string): NotionBlock {
    return {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    };
  }

  private createHeading3Block(text: string): NotionBlock {
    return {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    };
  }

  private createParagraphBlock(text: string): NotionBlock {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: this.parseRichText(text),
      },
    };
  }

  private createBulletBlock(text: string, link?: string): NotionBlock {
    return {
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: text, link: link ? { url: link } : null } }],
      },
    };
  }

  private createNumberedBlock(text: string): NotionBlock {
    return {
      object: 'block',
      type: 'numbered_list_item',
      numbered_list_item: {
        rich_text: [{ type: 'text', text: { content: text } }],
      },
    };
  }

  private createToggleBlock(title: string, children: NotionBlock[]): NotionBlock {
    return {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [{ type: 'text', text: { content: title } }],
        children,
      },
    };
  }

  private parseRichText(text: string): { type: string; text: { content: string }; annotations?: Record<string, boolean> }[] {
    const parts: { type: string; text: { content: string }; annotations?: Record<string, boolean> }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = /\*\*(.+?)\*\*/.exec(remaining);
      if (boldMatch?.index === 0) {
        parts.push({
          type: 'text',
          text: { content: boldMatch[1] },
          annotations: { bold: true },
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic
      const italicMatch = /\*(.+?)\*/.exec(remaining);
      if (italicMatch?.index === 0) {
        parts.push({
          type: 'text',
          text: { content: italicMatch[1] },
          annotations: { italic: true },
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Find next special character
      const nextBold = remaining.indexOf('**');
      const nextItalic = remaining.indexOf('*');
      const nextSpecial = Math.min(
        nextBold === -1 ? Infinity : nextBold,
        nextItalic === -1 ? Infinity : nextItalic,
      );

      if (nextSpecial === Infinity) {
        parts.push({ type: 'text', text: { content: remaining } });
        break;
      }

      if (nextSpecial > 0) {
        parts.push({ type: 'text', text: { content: remaining.slice(0, nextSpecial) } });
        remaining = remaining.slice(nextSpecial);
      } else {
        parts.push({ type: 'text', text: { content: remaining[0] } });
        remaining = remaining.slice(1);
      }
    }

    return parts.length > 0 ? parts : [{ type: 'text', text: { content: text } }];
  }

  private formatMetadataBlocks(metadata: Record<string, unknown>): NotionBlock[] {
    const blocks: NotionBlock[] = [];
    for (const [key, value] of Object.entries(metadata)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      blocks.push(this.createParagraphBlock(`${formattedKey}: ${String(value)}`));
    }
    return blocks;
  }

  private async notionRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Notion API error: ${error}`);
      throw new BadRequestException(`Notion API error: ${String(response.status)}`);
    }

    return response.json() as Promise<T>;
  }
}
