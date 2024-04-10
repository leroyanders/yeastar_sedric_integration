import { Module } from '@nestjs/common';
import { YeastarService } from './yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'https';
import { YeastarGateway } from './yeastar.gateway';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pbx',
    }),
    HttpModule.register({
      httpsAgent: new Agent({ rejectUnauthorized: false }),
    }),
  ],
  providers: [YeastarService, YeastarGateway],
  exports: [YeastarService, YeastarGateway],
})
export class YeastarModule {}
