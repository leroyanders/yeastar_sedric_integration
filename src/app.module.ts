import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { YeastarService } from './yeastar/yeastar.service';
import { SedricService } from './sedric/sedric.service';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/queue.module';
import { PbxEventsModule } from './pbx-events/pbx-events.module';
import { ScriptModule } from './script/script.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ScriptModule,
    QueueModule,
    HttpModule,
    PbxEventsModule,
  ],
  providers: [YeastarService, SedricService],
})
export class AppModule {}
