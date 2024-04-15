import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { YeastarService } from '../yeastar/yeastar.service';
import { SedricService } from '../sedric/sedric.service';
import {
  ApiDownloadRecordingUrlResponse,
  ICallRecord,
} from '../yeastar/yeastar.interface';
import { checkFileExists, handleFileCleanup } from '../utils/fs';
import { IInnerMessage } from '../yeastar/yeastar.interface';

@Processor('pbx')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private yeastarService: YeastarService,
    private sedricService: SedricService,

    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @Process('deleteRecording')
  async handleDeleteFile(
    job: Job<{
      path: string;
    }>,
  ) {
    handleFileCleanup(job.data.path)
      .then(() => {
        this.logger.debug('File was deleted:', job.data.path);
      })
      .catch((error) => {
        this.logger.error('Unable to delete file', error);
      });
  }

  @Process('sendRecording')
  async handleSendRecord(
    job: Job<{
      record: IInnerMessage | ICallRecord;
      downloadUrl: ApiDownloadRecordingUrlResponse;
      file: string;
    }>,
  ) {
    try {
      const { metadata } = this.sedricService.parseUserId(
        job.data.record.call_from,
      );

      const { team, memberName, apiKey } = this.sedricService.findMemberById(
        'call_id' in job.data.record
          ? job.data.record.call_to
          : job.data.record.call_from_number,
      );

      const timestamp =
        'call_id' in job.data.record
          ? job.data.record.time_start
          : job.data.record.time;

      const extension = job.data.downloadUrl.file.split('.').pop().slice(0, 3);
      const url = await this.sedricService.generateUploadUrl({
        user_id: memberName,
        prospect_id: job.data.record.call_to,
        unit_id: team,
        recording_type: extension,
        timestamp,
        topic: 'New CDR',
        api_key: apiKey,
        metadata,
      });

      this.sedricService
        .uploadRecording(job.data.file, url)
        .then(async () => {
          this.logger.log(`Successfully download record and sent`, {
            user_id: memberName,
            prospect_id: job.data.record.call_to,
            unit_id: team,
            recording_type: extension,
            timestamp,
            topic: 'New CDR',
            api_key: apiKey,
            uploadURL: url.url,
            downloadURL: job.data.downloadUrl,
            metadata,
            record: job.data.record,
          });

          await this.pbxQueue.add('deleteRecording', {
            path: job.data.file,
          });
        })
        .catch((error) => {
          throw error;
        });
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Process('downloadRecording')
  async handleDownload(
    job: Job<{
      record: ICallRecord;
      downloadUrl: ApiDownloadRecordingUrlResponse;
    }>,
  ) {
    this.logger.debug(
      `Downloading record from: ${job.data.downloadUrl.download_resource_url}`,
      job.data.record.id,
    );

    try {
      const file = await this.yeastarService.downloadRecording(
        job.data.downloadUrl,
      );

      await this.pbxQueue.add('sendRecording', {
        record: job.data.record,
        downloadUrl: job.data.downloadUrl,
        file: file,
      });
    } catch (e) {
      this.logger.error(e);
    }
  }

  @Process('processRecording')
  async handleProcess(job: Job<{ record: ICallRecord | IInnerMessage }>) {
    if ('id' in job.data.record) {
      this.logger.debug(
        'Check for exciting record locally...',
        job.data.record.id,
      );
    }

    if ('call_id' in job.data.record) {
      this.logger.debug(
        'PBX: Check for exciting record locally...',
        job.data.record.id,
      );
    }

    const exists = await checkFileExists(
      'file' in job.data.record
        ? job.data.record.file
        : job.data.record.recording,
    );

    if (!exists) this.logger.debug('No exciting record locally');
    this.yeastarService
      .getRecordingDownloadUrl(job.data.record.id)
      .then(async (downloadUrl: ApiDownloadRecordingUrlResponse) => {
        await this.pbxQueue.add('downloadRecording', {
          record: job.data.record,
          downloadUrl,
        });
      })
      .catch(async (err) => {
        this.logger.error(`Download URL was refused: ${err.message}`);
      });
  }
}
