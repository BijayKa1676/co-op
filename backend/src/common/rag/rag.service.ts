import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from '@/common/circuit-breaker/circuit-breaker.service';
import {
  SemanticSearchRequest,
  SemanticSearchResponse,
  EmbedDocumentRequest,
  EmbedDocumentResponse,
  DocumentStatusResponse,
  DeleteDocumentResponse,
  RagDocument,
} from './rag.types';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly ragBaseUrl: string;
  private readonly ragApiKey: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.ragBaseUrl = this.configService.get<string>('RAG_SERVICE_URL', '');
    this.ragApiKey = this.configService.get<string>('RAG_API_KEY', '');
    this.isConfigured = Boolean(this.ragBaseUrl && this.ragApiKey);

    if (this.isConfigured) {
      this.logger.log(`RAG service configured: ${this.ragBaseUrl}`);
    } else {
      this.logger.warn('RAG service not configured - semantic search disabled');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  async semanticSearch(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    if (!this.isConfigured) {
      return {
        documents: [],
        query: request.query,
        totalFound: 0,
        processingTimeMs: 0,
      };
    }

    const searchFn = async (): Promise<SemanticSearchResponse> => {
      const response = await fetch(`${this.ragBaseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ragApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: request.query,
          startup_id: request.startupId,
          limit: request.limit,
          threshold: request.threshold,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`RAG search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data as SemanticSearchResponse;
    };

    try {
      return await this.circuitBreaker.execute('rag-search', searchFn, () => ({
        documents: [],
        query: request.query,
        totalFound: 0,
        processingTimeMs: 0,
      }));
    } catch (error) {
      this.logger.error('Semantic search failed', error);
      return {
        documents: [],
        query: request.query,
        totalFound: 0,
        processingTimeMs: 0,
      };
    }
  }

  async getRelevantContext(
    query: string,
    startupId: string,
    limit = 5,
    threshold = 0.7,
  ): Promise<string> {
    const result = await this.semanticSearch({
      query,
      startupId,
      limit,
      threshold,
    });

    if (result.documents.length === 0) {
      return '';
    }

    return this.formatDocumentsAsContext(result.documents);
  }

  private formatDocumentsAsContext(documents: RagDocument[]): string {
    if (documents.length === 0) {
      return '';
    }

    const contextParts = documents.map((doc, index) => {
      const source = doc.metadata.filename || 'Unknown source';
      const page = doc.metadata.pageNumber ? ` (Page ${String(doc.metadata.pageNumber)})` : '';
      return `[Source ${String(index + 1)}: ${source}${page}]\n${doc.content}`;
    });

    return `\n\n--- Relevant Document Context ---\n${contextParts.join('\n\n---\n\n')}\n--- End Context ---\n`;
  }

  async embedDocument(request: EmbedDocumentRequest): Promise<EmbedDocumentResponse> {
    if (!this.isConfigured) {
      return {
        documentId: request.documentId,
        status: 'failed',
        chunksCreated: 0,
        message: 'RAG service not configured',
      };
    }

    try {
      const response = await fetch(`${this.ragBaseUrl}/api/embed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ragApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: request.documentId,
          file_path: request.filePath,
          startup_id: request.startupId,
          filename: request.filename,
          metadata: request.metadata,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`Embed request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data as EmbedDocumentResponse;
    } catch (error) {
      this.logger.error('Document embedding failed', error);
      return {
        documentId: request.documentId,
        status: 'failed',
        chunksCreated: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDocumentStatus(documentId: string): Promise<DocumentStatusResponse | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await fetch(`${this.ragBaseUrl}/api/documents/${documentId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.ragApiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data as DocumentStatusResponse;
    } catch (error) {
      this.logger.error('Document status check failed', error);
      return null;
    }
  }

  async deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
    if (!this.isConfigured) {
      return {
        documentId,
        chunksDeleted: 0,
        success: false,
      };
    }

    try {
      const response = await fetch(`${this.ragBaseUrl}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.ragApiKey}`,
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data as DeleteDocumentResponse;
    } catch (error) {
      this.logger.error('Document deletion failed', error);
      return {
        documentId,
        chunksDeleted: 0,
        success: false,
      };
    }
  }
}
