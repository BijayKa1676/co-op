import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { RedisModule } from '@/common/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [SupabaseService, SupabaseStorageService],
  exports: [SupabaseService, SupabaseStorageService],
})
export class SupabaseModule {}
