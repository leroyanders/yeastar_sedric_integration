import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PbxEventsGateway } from './pbx-events.gateway';

@Module({
  imports: [QueueModule],
  providers: [PbxEventsGateway],
  exports: [PbxEventsGateway],
})
export class PbxEventsModule {}
