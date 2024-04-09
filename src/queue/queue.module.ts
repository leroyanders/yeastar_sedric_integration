import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { QueueProcessor } from './queue.processor';
import { YeastarService } from '../yeastar/yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { SedricService } from '../sedric/sedric.service';
import { Agent } from 'https';
import { PbxEventsGateway } from '../pbx-events/pbx-events.gateway';
import { Queue } from 'bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pbx',
    }),
    HttpModule.register({
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    }),
  ],
  providers: [QueueProcessor, YeastarService, SedricService, PbxEventsGateway],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit {
  constructor(@InjectQueue('pbx') private readonly pbxQueue: Queue) {}

  async onModuleInit(): Promise<any> {
    await this.pbxQueue.empty();
  }
}
