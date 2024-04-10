import { Module } from '@nestjs/common';
import { YeastarService } from './yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { QueueModule } from '../queue/queue.module';
import { Agent } from 'https';
import { YeastarGateway } from './yeastar.gateway';

@Module({
  imports: [
    QueueModule,
    HttpModule.register({
      httpsAgent: new Agent({ rejectUnauthorized: false }),
    }),
  ],
  providers: [YeastarService, YeastarGateway],
})
export class YeastarModule {}
