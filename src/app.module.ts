import { Module } from '@nestjs/common';
import { ScriptModule } from './script/script.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'https';
import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    RedisModule.forRoot({
      type: 'single',
      url: '127.0.0.1:6379',
    }),
    HttpModule.register({
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    }),
    ScriptModule,
  ],
})
export class AppModule {}
