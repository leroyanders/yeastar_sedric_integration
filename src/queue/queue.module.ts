import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueProcessor } from './queue.processor';
import { YeastarService } from '../yeastar/yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { SedricService } from '../sedric/sedric.service';
import { Agent } from 'https';

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
  providers: [QueueProcessor, YeastarService, SedricService],
  exports: [BullModule],
})
export class QueueModule {}
