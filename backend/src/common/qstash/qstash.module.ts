import { Module, Global } from '@nestjs/common';
import { QStashService } from './qstash.service';

@Global()
@Module({
  providers: [QStashService],
  exports: [QStashService],
})
export class QStashModule {}
