import { Module, forwardRef } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsScheduler } from './sessions.scheduler';
import { WebhooksModule } from '@/modules/webhooks/webhooks.module';

@Module({
  imports: [forwardRef(() => WebhooksModule)],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsScheduler],
  exports: [SessionsService],
})
export class SessionsModule {}
