import { Module } from '@nestjs/common';
import { ScriptModule } from './script/script.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { Agent } from 'https';
import { CacheModule, CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

const RedisOptions: CacheModuleAsyncOptions = {
  isGlobal: true,
  useFactory: async () => {
    const store = await redisStore({
      socket: {
        host: '127.0.0.1',
        port: 6379,
      },
    });

    return {
      store,
    };
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync(RedisOptions),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
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
