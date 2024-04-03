import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PbxEventsGateway } from './pbx-events.gateway';
import { YeastarService } from '../yeastar/yeastar.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [QueueModule, HttpModule],
  providers: [PbxEventsGateway, YeastarService],
  exports: [PbxEventsGateway],
})
export class PbxEventsModule {}
