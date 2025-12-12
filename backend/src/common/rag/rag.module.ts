import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { CircuitBreakerModule } from '@/common/circuit-breaker/circuit-breaker.module';

@Module({
  imports: [CircuitBreakerModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
