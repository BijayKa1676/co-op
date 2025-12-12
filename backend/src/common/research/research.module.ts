import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResearchService } from './research.service';

@Module({
  imports: [ConfigModule],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
