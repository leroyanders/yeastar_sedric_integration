import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { YeastarService } from '../yeastar/yeastar.service';
import { HttpModule } from '@nestjs/axios';
import { PbxEventsGateway } from '../pbx-events/pbx-events.gateway';
import { PbxEventsModule } from '../pbx-events/pbx-events.module';
import { BullModule, InjectQueue } from '@nestjs/bull';
import {
  IApiRecordsListResponse,
  ICallRecord,
} from '../yeastar/yeastar.interface';
import { Queue } from 'bull';

@Module({
  imports: [
    HttpModule,
    PbxEventsModule,
    BullModule.registerQueue({
      name: 'pbx',
    }),
  ],
  providers: [YeastarService, PbxEventsGateway],
})
export class ScriptModule implements OnModuleInit {
  private readonly logger = new Logger(ScriptModule.name);
  private page = 1;
  private pageSize = 50;
  private pagesCount = 0;
  private recordsList: ICallRecord[] = [];

  constructor(
    private yeastarService: YeastarService,
    private pbxGateway: PbxEventsGateway,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  async onModuleInit() {
    // 1. Auth
    const { accessToken } = await this.yeastarService.initialize();

    // 2. Init Gateway
    await this.pbxGateway.initialize(accessToken);

    // 3. Fetch records & save to array
    this.yeastarService
      .fetchRecordingList(accessToken, this.page, this.pageSize)
      .then(async (recordingList: IApiRecordsListResponse) => {
        const { total_number } = recordingList;
        this.pagesCount = Math.ceil(total_number / this.pageSize);

        for (this.page; this.page <= this.pagesCount; this.page++) {
          const response = await this.yeastarService.fetchRecordingList(
            accessToken,
            this.page,
            this.pageSize,
          );

          // 4. Save records
          response.data.forEach((record) => this.recordsList.push(record));

          // 5. Send each record to queue
          if (this.page === this.pagesCount) {
            for (const record of this.recordsList) {
              await this.pbxQueue.add('process', {
                record,
                accessToken,
              });
            }
          }
        }
      })
      .catch((err) => {
        this.logger.error(err.message);
      });
  }
}
