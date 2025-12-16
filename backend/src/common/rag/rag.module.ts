import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { RagCacheService } from './rag-cache.service';
import { CircuitBreakerModule } from '@/common/circuit-breaker/circuit-breaker.module';

/**
 * RAG Module
 * 
 * Provides RAG (Retrieval-Augmented Generation) services including:
 * - RagService: Core RAG query and document management
 * - RagCacheService: Query result caching
 * 
 * CLaRA (Apple CLaRA-7B-Instruct) is handled by the Python RAG service
 * for intelligent context compression and query-aware extraction.
 */
@Module({
  imports: [CircuitBreakerModule],
  providers: [RagService, RagCacheService],
  exports: [RagService, RagCacheService],
})
export class RagModule {}
