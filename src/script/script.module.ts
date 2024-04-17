import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { YeastarService } from '../yeastar/yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bull';
import {
  ECallType,
  IApiRecordsListResponse,
  ICallRecord,
} from '../yeastar/yeastar.interface';
import { Queue } from 'bull';
import { Agent } from 'https';
import { QueueModule } from '../queue/queue.module';
import { YeastarModule } from '../yeastar/yeastar.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Module({
  imports: [
    QueueModule,
    YeastarModule,
    HttpModule.register({
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    }),
  ],
})
export class ScriptModule implements OnModuleInit {
  private readonly logger = new Logger(ScriptModule.name);
  private page = 1;
  private pageSize = 50;
  private pagesCount = 0;
  private recordsList: ICallRecord[] = [];

  constructor(
    private yeastarService: YeastarService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  async onModuleInit() {
    this.yeastarService
      .initialize()
      .then(async ({ accessToken }) => {
        this.logger.debug(`Provided token: ${accessToken}`);
        this.yeastarService
          .fetchRecordingList(this.page, this.pageSize)
          .then(async (recordingList: IApiRecordsListResponse) => {
            const { total_number } = recordingList;

            this.pagesCount = Math.ceil(total_number / this.pageSize);
            this.logger.debug(`Pages count: ${this.pagesCount}`);

            for (this.page; this.page <= this.pagesCount; this.page++) {
              const response = await this.yeastarService.fetchRecordingList(
                this.page,
                this.pageSize,
              );

              for (const record of response.data) {
                const value = await this.cacheManager.get(String(record.id));

                if (!value && record.call_type === ECallType.OUTBOUND) {
                  this.recordsList.push(record);
                }
              }

              if (this.page === this.pagesCount) {
                for (const record of this.recordsList) {
                  await this.pbxQueue.add('processRecording', {
                    record,
                  });
                }
              }
            }
          })
          .catch((err) => {
            throw err;
          });
      })
      .catch((err) => {
        this.logger.error(err);
      });
  }
}
