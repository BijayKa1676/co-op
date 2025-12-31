import { Module } from '@nestjs/common';
import { PitchDeckController } from './pitch-deck.controller';
import { PitchDeckService } from './pitch-deck.service';
import { DatabaseModule } from '@/database/database.module';
import { SupabaseModule } from '@/common/supabase/supabase.module';
import { LlmModule } from '@/common/llm/llm.module';
import { RagModule } from '@/common/rag/rag.module';

@Module({
  imports: [DatabaseModule, SupabaseModule, LlmModule, RagModule],
  controllers: [PitchDeckController],
  providers: [PitchDeckService],
  exports: [PitchDeckService],
})
export class PitchDeckModule {}
