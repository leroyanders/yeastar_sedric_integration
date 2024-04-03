import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PbxEventsGateway } from './pbx-events.gateway';
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'https';

@Module({
  imports: [
    QueueModule,
    HttpModule.register({
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    }),
  ],
  providers: [PbxEventsGateway],
  exports: [PbxEventsGateway],
})
export class PbxEventsModule {}
