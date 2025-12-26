import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RedisModule } from '@/common/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
