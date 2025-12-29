import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { SupabaseStorageService } from '@/common/supabase/supabase-storage.service';
import { RagService } from '@/common/rag/rag.service';
import { AuditService } from '@/common/audit/audit.service';
import { UploadPdfDto } from './dto';
import { ListEmbeddingsQueryDto, EmbeddingResponseDto } from './dto';
import { PaginatedResult } from '@/common/dto/pagination.dto';

interface UploadResult {
  id: string;
  status: string;
  storagePath: string;
  domain: string;
  sector: string;
  region: string;
  jurisdictions: string[];
  documentType: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly storage: SupabaseStorageService,
    private readonly ragService: RagService,
    private readonly audit: AuditService,
  ) {}

  async uploadPdf(
    dto: UploadPdfDto,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const fileId = uuid();

    const sanitizedFilename = dto.filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .slice(0, 255);

    const region = dto.region ?? 'global';
    const storagePath = `${dto.domain}/${dto.sector}/${region}/${fileId}/${sanitizedFilename}`;

    const uploadResult = await this.storage.upload(storagePath, fileBuffer, contentType);
    this.logger.log(`File uploaded: ${uploadResult.path}`);

    const jurisdictions = dto.jurisdictions ?? ['general'];
    const documentType = dto.documentType ?? 'guide';

    if (this.ragService.isAvailable()) {
      const registerResult = await this.ragService.registerFile({
        fileId,
        filename: sanitizedFilename,
        storagePath: uploadResult.path,
        domain: dto.domain,
        sector: dto.sector,
        contentType,
        region,
        jurisdictions,
        documentType,
      });

      if (!registerResult.success) {
        await this.storage.delete(storagePath);
        throw new BadRequestException(`RAG registration failed: ${registerResult.message}`);
      }
    }

    await this.audit.log({
      userId: null,
      action: 'embedding.uploaded',
      resource: 'embedding',
      resourceId: fileId,
      oldValue: null,
      newValue: { filename: sanitizedFilename, domain: dto.domain, sector: dto.sector, region, jurisdictions, documentType },
      ipAddress: null,
      userAgent: null,
      metadata: { storagePath: uploadResult.path },
    });

    return { id: fileId, status: 'pending', storagePath: uploadResult.path, domain: dto.domain, sector: dto.sector, region, jurisdictions, documentType };
  }

  async forceVectorize(fileId: string): Promise<{ chunksCreated: number }> {
    if (!this.isValidUuid(fileId)) {
      throw new BadRequestException('Invalid file ID format');
    }

    if (!this.ragService.isAvailable()) {
      throw new BadRequestException('RAG service not configured');
    }

    const result = await this.ragService.vectorizeFile(fileId);

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    this.logger.log(`Vectorization complete: ${result.chunksCreated} chunks`);
    return { chunksCreated: result.chunksCreated };
  }

  async listEmbeddings(query: ListEmbeddingsQueryDto): Promise<PaginatedResult<EmbeddingResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (!this.ragService.isAvailable()) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    try {
      const domain = query.domain;
      const sector = query.sector;
      const region = query.region;
      const result = await this.ragService.listFiles(domain, sector, region);

      const embeddings: EmbeddingResponseDto[] = result.files.map((file) => ({
        id: file.id,
        filename: file.filename,
        storagePath: file.storagePath,
        domain: file.domain,
        sector: file.sector,
        region: file.region ?? 'global',
        jurisdictions: file.jurisdictions ?? ['general'],
        documentType: file.documentType ?? 'guide',
        status: file.vectorStatus,
        chunksCreated: file.chunkCount,
        lastAccessed: file.lastAccessed ? new Date(file.lastAccessed) : undefined,
        createdAt: new Date(file.createdAt),
      }));

      // Paginate
      const total = embeddings.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedData = embeddings.slice(startIndex, startIndex + limit);

      return { data: paginatedData, meta: { total, page, limit, totalPages } };
    } catch (error) {
      this.logger.error('Failed to list embeddings', error);
      throw new BadRequestException('Failed to retrieve embeddings');
    }
  }

  async getEmbedding(id: string): Promise<EmbeddingResponseDto> {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid file ID format');
    }

    if (!this.ragService.isAvailable()) {
      throw new NotFoundException('RAG service not configured');
    }

    const file = await this.ragService.getFile(id);
    if (!file) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: file.id,
      filename: file.filename,
      storagePath: file.storagePath,
      domain: file.domain,
      sector: file.sector,
      region: file.region ?? 'global',
      jurisdictions: file.jurisdictions ?? ['general'],
      documentType: file.documentType ?? 'guide',
      status: file.vectorStatus,
      chunksCreated: file.chunkCount,
      lastAccessed: file.lastAccessed ? new Date(file.lastAccessed) : undefined,
      createdAt: new Date(file.createdAt),
    };
  }

  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  async deleteEmbedding(id: string): Promise<void> {
    if (!this.isValidUuid(id)) {
      throw new BadRequestException('Invalid file ID format');
    }

    const file = await this.ragService.getFile(id);
    if (!file) {
      throw new NotFoundException('Document not found');
    }

    const result = await this.ragService.deleteFile(id);
    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    try {
      await this.storage.delete(file.storagePath);
    } catch (error) {
      this.logger.warn(`Failed to delete from storage: ${file.storagePath}`, error);
    }

    await this.audit.log({
      userId: null,
      action: 'embedding.deleted',
      resource: 'embedding',
      resourceId: id,
      oldValue: { filename: file.filename, domain: file.domain, sector: file.sector },
      newValue: null,
      ipAddress: null,
      userAgent: null,
      metadata: { chunksDeleted: result.chunksDeleted },
    });
  }

  async cleanupExpiredVectors(days = 30): Promise<{ filesCleaned: number; vectorsRemoved: number }> {
    if (!this.ragService.isAvailable()) {
      throw new BadRequestException('RAG service not configured');
    }
    return this.ragService.cleanupExpired(days);
  }
}
