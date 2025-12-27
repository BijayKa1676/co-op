import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly bucket: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET', 'documents');
  }

  async upload(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
    bucketName?: string,
  ): Promise<UploadResult> {
    const bucket = bucketName ?? this.bucket;
    const client = this.supabase.getServiceClient();

    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Validate content type
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'application/json', 'image/png', 'image/jpeg'];
    if (!allowedTypes.some(t => contentType.startsWith(t.split('/')[0]))) {
      this.logger.warn(`Potentially unsafe content type: ${contentType}`);
    }

    const { data, error } = await client.storage.from(bucket).upload(filePath, fileBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = client.storage.from(bucket).getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl,
    };
  }

  async getSignedUrl(
    filePath: string,
    expiresInSeconds = 3600,
    bucketName?: string,
  ): Promise<SignedUrlResult> {
    const bucket = bucketName ?? this.bucket;
    const client = this.supabase.getServiceClient();

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data) {
      this.logger.error(`Failed to create signed URL: ${error?.message ?? 'Unknown error'}`);
      throw new Error(`Failed to create signed URL: ${error?.message ?? 'Unknown error'}`);
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async delete(filePath: string, bucketName?: string): Promise<void> {
    const bucket = bucketName ?? this.bucket;
    const client = this.supabase.getServiceClient();

    // Sanitize file path to prevent path traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    const { error } = await client.storage.from(bucket).remove([sanitizedPath]);

    if (error) {
      this.logger.error(`Delete failed: ${error.message}`);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async list(
    prefix?: string,
    bucketName?: string,
  ): Promise<{ name: string; id: string; createdAt: string }[]> {
    const bucket = bucketName ?? this.bucket;
    const client = this.supabase.getServiceClient();

    // Sanitize prefix to prevent path traversal
    const sanitizedPrefix = prefix?.replace(/\.\./g, '').replace(/^\/+/, '');

    const { data, error } = await client.storage.from(bucket).list(sanitizedPrefix);

    if (error) {
      this.logger.error(`List failed: ${error.message}`);
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (data ?? []).map(file => ({
      name: file.name,
      id: file.id ?? file.name,
      createdAt: file.created_at ?? new Date().toISOString(),
    }));
  }

  async download(filePath: string, bucketName?: string): Promise<Buffer> {
    const bucket = bucketName ?? this.bucket;
    const client = this.supabase.getServiceClient();

    // Sanitize file path to prevent path traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\/+/, '');

    const { data, error } = await client.storage.from(bucket).download(sanitizedPath);

    if (error || !data) {
      this.logger.error(`Download failed: ${error?.message ?? 'Unknown error'}`);
      throw new Error(`Failed to download file: ${error?.message ?? 'Unknown error'}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
