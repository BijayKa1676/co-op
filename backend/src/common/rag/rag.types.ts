// RAG Service Types - Communication with the RAG backend

export interface RagDocument {
  id: string;
  content: string;
  metadata: RagDocumentMetadata;
  score: number;
}

export interface RagDocumentMetadata {
  filename: string;
  startupId: string;
  pageNumber: number;
  chunkIndex: number;
  source: string;
}

export interface SemanticSearchRequest {
  query: string;
  startupId: string;
  limit: number;
  threshold: number;
}

export interface SemanticSearchResponse {
  documents: RagDocument[];
  query: string;
  totalFound: number;
  processingTimeMs: number;
}

export interface EmbedDocumentRequest {
  documentId: string;
  filePath: string;
  startupId: string;
  filename: string;
  metadata: Record<string, unknown>;
}

export interface EmbedDocumentResponse {
  documentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  chunksCreated: number;
  message: string;
}

export interface DocumentStatusResponse {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunksCreated: number;
  error: string;
  createdAt: string;
  completedAt: string;
}

export interface DeleteDocumentResponse {
  documentId: string;
  chunksDeleted: number;
  success: boolean;
}
