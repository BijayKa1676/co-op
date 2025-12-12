export interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, { title?: { plain_text: string }[] }>;
}

export interface NotionSearchResult {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface NotionBlock {
  object: string;
  type: string;
  [key: string]: unknown;
}

export interface ExportToNotionRequest {
  pageId: string;
  title: string;
  agentType: string;
  content: string;
  sources: string[];
  metadata: Record<string, unknown>;
}

export interface NotionExportResult {
  pageId: string;
  pageUrl: string;
  title: string;
  exportedAt: Date;
}

export interface NotionIntegrationStatus {
  connected: boolean;
  workspaceName: string | null;
  workspaceIcon: string | null;
  defaultPageId: string | null;
}
