import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuid } from 'uuid';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { SupabaseStorageService } from '@/common/supabase/supabase-storage.service';
import * as schema from '@/database/schema';
import { UploadPdfDto, ListEmbeddingsQueryDto, EmbeddingResponseDto } from './dto';
import { PaginatedResult } from '@/common/dto/pagination.dto';

interface UploadResult {
  id: string;
  status: string;
  path: string;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly storage: SupabaseStorageService,
  ) {}

  async uploadPdf(
    dto: UploadPdfDto,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const id = uuid();
    const filePath = `pdfs/${id}/${dto.filename}`;

    const uploadResult = await this.storage.upload(filePath, fileBuffer, contentType);

    // TODO: Store embedding record in database
    // TODO: Queue for embedding processing

    return {
      id,
      status: 'pending',
      path: uploadResult.path,
    };
  }

  listEmbeddings(query: ListEmbeddingsQueryDto): PaginatedResult<EmbeddingResponseDto> {
    // TODO: Implement list embeddings from database
    return {
      data: [],
      meta: {
        total: 0,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        totalPages: 0,
      },
    };
  }

  getEmbedding(_id: string): EmbeddingResponseDto {
    // TODO: Implement get embedding from database
    throw new NotFoundException('Embedding not found');
  }

  async deleteEmbedding(id: string): Promise<void> {
    // TODO: Fetch actual file path from database
    // For now, try to delete the folder
    const folderPath = `pdfs/${id}`;

    try {
      // List files in the folder and delete them
      const files = await this.storage.list(folderPath);
      for (const file of files) {
        await this.storage.delete(`${folderPath}/${file.name}`);
      }
    } catch {
      // Folder might not exist or already deleted
    }

    // TODO: Remove from vector store
    // TODO: Remove from database
  }

  async getSignedUrl(filePath: string): Promise<{ signedUrl: string; expiresAt: Date }> {
    return this.storage.getSignedUrl(filePath, 3600);
  }
}
