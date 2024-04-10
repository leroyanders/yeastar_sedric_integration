import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { QueueProcessor } from './queue.processor';
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'https';
import { Queue } from 'bull';
import { SedricService } from '../sedric/sedric.service';
import { YeastarModule } from '../yeastar/yeastar.module';

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
    YeastarModule,
  ],
  providers: [QueueProcessor, SedricService],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit {
  constructor(@InjectQueue('pbx') private readonly pbxQueue: Queue) {}

  async onModuleInit(): Promise<any> {
    await this.pbxQueue.empty();
  }
}
