import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { SupabaseStorageService } from '@/common/supabase/supabase-storage.service';
import { RagService } from '@/common/rag/rag.service';
import { UploadPdfDto, ListEmbeddingsQueryDto, EmbeddingResponseDto } from './dto';
import { PaginatedResult } from '@/common/dto/pagination.dto';

interface UploadResult {
  id: string;
  status: string;
  path: string;
  embeddingStatus: string;
}

interface StorageFile {
  name: string;
  id: string;
  createdAt: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly storage: SupabaseStorageService,
    private readonly ragService: RagService,
  ) {}

  async uploadPdf(
    dto: UploadPdfDto,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const id = uuid();
    const filePath = `pdfs/${id}/${dto.filename}`;

    // Upload to Supabase Storage
    const uploadResult = await this.storage.upload(filePath, fileBuffer, contentType);

    // Queue for embedding processing via RAG service
    let embeddingStatus = 'skipped';
    if (this.ragService.isAvailable()) {
      const embedResult = await this.ragService.embedDocument({
        documentId: id,
        filePath: uploadResult.path,
        startupId: dto.startupId,
        filename: dto.filename,
        metadata: dto.metadata,
      });
      embeddingStatus = embedResult.status;
      this.logger.log(`Document ${id} queued for embedding: ${embeddingStatus}`);
    } else {
      this.logger.warn('RAG service not available - document uploaded but not embedded');
    }

    return {
      id,
      status: 'uploaded',
      path: uploadResult.path,
      embeddingStatus,
    };
  }

  async listEmbeddings(query: ListEmbeddingsQueryDto): Promise<PaginatedResult<EmbeddingResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    try {
      // List all PDF folders from storage
      const folders = await this.storage.list('pdfs');

      // Get embedding status for each folder (document)
      const embeddings: EmbeddingResponseDto[] = [];

      for (const folder of folders) {
        // folder.name is the document ID
        const documentId = folder.name;

        // Try to get status from RAG service
        if (this.ragService.isAvailable()) {
          const status = await this.ragService.getDocumentStatus(documentId);
          if (status) {
            embeddings.push({
              id: documentId,
              status: status.status,
              chunksCreated: status.chunksCreated,
              createdAt: new Date(status.createdAt),
              completedAt: status.completedAt ? new Date(status.completedAt) : undefined,
              error: status.error || undefined,
            });
            continue;
          }
        }

        // Fallback: document exists in storage but no RAG status
        embeddings.push({
          id: documentId,
          status: 'pending',
          chunksCreated: 0,
          createdAt: new Date(folder.createdAt),
        });
      }

      // Sort by createdAt descending
      embeddings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Paginate
      const total = embeddings.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedData = embeddings.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Failed to list embeddings', error);
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }
  }

  async getEmbedding(id: string): Promise<EmbeddingResponseDto> {
    // First check if document exists in storage
    try {
      const files = await this.storage.list(`pdfs/${id}`);
      if (files.length === 0) {
        throw new NotFoundException('Document not found');
      }
    } catch {
      throw new NotFoundException('Document not found');
    }

    // Check embedding status from RAG service
    if (this.ragService.isAvailable()) {
      const status = await this.ragService.getDocumentStatus(id);
      if (status) {
        return {
          id,
          status: status.status,
          chunksCreated: status.chunksCreated,
          createdAt: new Date(status.createdAt),
          completedAt: status.completedAt ? new Date(status.completedAt) : undefined,
          error: status.error || undefined,
        };
      }
    }

    // Document exists but no RAG status
    return {
      id,
      status: 'pending',
      chunksCreated: 0,
      createdAt: new Date(),
    };
  }

  async deleteEmbedding(id: string): Promise<void> {
    const folderPath = `pdfs/${id}`;

    // Delete from RAG service (vector store)
    if (this.ragService.isAvailable()) {
      const result = await this.ragService.deleteDocument(id);
      this.logger.log(`Deleted ${String(result.chunksDeleted)} chunks from vector store`);
    }

    // Delete from Supabase Storage
    try {
      const files = await this.storage.list(folderPath);
      for (const file of files) {
        await this.storage.delete(`${folderPath}/${file.name}`);
      }
      this.logger.log(`Deleted files from storage: ${folderPath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete from storage: ${folderPath}`, error);
    }
  }

  async getSignedUrl(filePath: string): Promise<{ signedUrl: string; expiresAt: Date }> {
    return this.storage.getSignedUrl(filePath, 3600);
  }

  async getDocumentFiles(id: string): Promise<StorageFile[]> {
    try {
      return await this.storage.list(`pdfs/${id}`);
    } catch {
      return [];
    }
  }
}
