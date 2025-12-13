import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RagModule } from '@/common/rag/rag.module';

@Module({
  imports: [RagModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
