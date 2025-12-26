import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { ResearchModule } from '@/common/research/research.module';
import { LlmModule } from '@/common/llm/llm.module';
import { CacheModule } from '@/common/cache/cache.module';
import { EmailModule } from '@/common/email/email.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailTrackingService } from './email-tracking.service';

@Module({
  imports: [
    DatabaseModule,
    ResearchModule,
    LlmModule,
    CacheModule,
    EmailModule,
  ],
  controllers: [LeadsController, CampaignsController, EmailTrackingController],
  providers: [LeadsService, CampaignsService, EmailTrackingService],
  exports: [LeadsService, CampaignsService, EmailTrackingService],
})
export class OutreachModule {}
