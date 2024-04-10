import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { YeastarService } from '../yeastar/yeastar.service';
import { SedricService } from '../sedric/sedric.service';
import {
  ApiDownloadRecordingUrlResponse,
  ICallRecord,
} from '../yeastar/yeastar.interface';
import { checkFileExists, handleFileCleanup } from '../utils/file-system';
import { ConfigService } from '@nestjs/config';
import { IInnerMessage } from '../pbx-events/pbx-events.interface';

@Processor('pbx')
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
    private configService: ConfigService,
    private yeastarService: YeastarService,
    private sedricService: SedricService,
  ) {}

  @Process('delete_file')
  async handleDeleteFile(
    job: Job<{
      path: string;
    }>,
  ) {
    try {
      await handleFileCleanup(job.data.path);
    } catch (error) {
      this.logger.error('Unable to delete file', error);
    }
  }

  @Process('pbx_download')
  async handlePBXDownload(
    job: Job<{
      record: IInnerMessage;
      accessToken: string;
      downloadUrl: ApiDownloadRecordingUrlResponse;
    }>,
  ) {
    this.logger.debug(
      `Downloading PBX record from: ${job.data.downloadUrl.download_resource_url}`,
      job.data.record.call_id,
    );

    try {
      const file = await this.yeastarService.downloadRecording(
        job.data.downloadUrl,
      );

      const { user_id, metadata } = this.sedricService.parseUserId(
        job.data.record.call_from,
      );

      const extension = job.data.downloadUrl.file.split('.').pop().slice(0, 3);
      const url = await this.sedricService.generateUploadUrl({
        user_id,
        prospect_id: job.data.record.call_to,
        unit_id: this.configService.get('SEDRIC_UNIT_ID'),
        recording_type: extension,
        timestamp: job.data.record.time_start,
        topic: 'New CDR',
        api_key: this.configService.get('SEDRIC_API_KEY'),
        metadata,
      });

      await this.sedricService.uploadRecording(file, url);
      await this.pbxQueue.add('delete_file', {
        path: file,
      });

      this.logger.log(`Successfully download record PBX and sent`, {
        user_id,
        prospect_id: job.data.record.call_to,
        unit_id: this.configService.get('SEDRIC_UNIT_ID'),
        recording_type: extension,
        timestamp: job.data.record.time_start,
        topic: 'New CDR',
        api_key: this.configService.get('SEDRIC_API_KEY'),
        uploadURL: url.url,
        downloadURL: job.data.downloadUrl,
        metadata,
        record: job.data.record,
      });
    } catch (e) {
      console.log(e);
    }
  }

  @Process('download')
  async handleDownload(
    job: Job<{
      record: ICallRecord;
      accessToken: string;
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

      const { user_id, metadata } = this.sedricService.parseUserId(
        job.data.record.call_from,
      );

      const extension = job.data.downloadUrl.file.split('.').pop().slice(0, 3);
      const url = await this.sedricService.generateUploadUrl({
        user_id,
        prospect_id: job.data.record.call_to,
        unit_id: this.configService.get('SEDRIC_UNIT_ID'),
        recording_type: extension,
        timestamp: job.data.record.time,
        topic: 'New CDR',
        api_key: this.configService.get('SEDRIC_API_KEY'),
        metadata,
      });

      await this.sedricService.uploadRecording(file, url);
      await this.pbxQueue.add('delete_file', {
        path: file,
      });

      this.logger.log(`Successfully download record and sent`, {
        user_id,
        prospect_id: job.data.record.call_to,
        unit_id: this.configService.get('SEDRIC_UNIT_ID'),
        recording_type: extension,
        timestamp: job.data.record.time,
        topic: 'New CDR',
        api_key: this.configService.get('SEDRIC_API_KEY'),
        uploadURL: url.url,
        downloadURL: job.data.downloadUrl,
        metadata,
        record: job.data.record,
      });
    } catch (e) {
      console.log(e);
    }
  }

  @Process('process')
  async handleProcess(job: Job<{ record: ICallRecord; accessToken: string }>) {
    this.logger.debug(
      'Check for exciting record locally...',
      job.data.record.id,
    );

    // 6. Check for exciting record locally
    const exists = await checkFileExists(job.data.record.file);
    if (!exists) {
      this.logger.debug('No exciting record locally');

      // 7. Get record's download URL
      this.yeastarService
        .getRecordingDownloadUrl(job.data.accessToken, job.data.record.id)
        .then(async (downloadUrl: ApiDownloadRecordingUrlResponse) => {
          // 8. Download record
          await this.pbxQueue.add('download', {
            record: job.data.record,
            accessToken: job.data.accessToken,
            downloadUrl,
          });
        })
        .catch(async (err) => {
          this.logger.error(`Download URL was refused: ${err.message}`);
        });
    }
  }

  @Process('pbx_process')
  async handlePBXProcess(
    job: Job<{ record: IInnerMessage; accessToken: string }>,
  ) {
    this.logger.debug(
      `PBX: Check for exciting record locally...: ${job.data.record.call_id}`,
    );

    // 6. Check for exciting record locally for PBX
    const exists = await checkFileExists(job.data.record.recording);
    if (!exists) {
      this.logger.debug('No exciting record locally');

      // 7. Get record's download URL
      this.yeastarService
        .getRecordingDownloadUrl(
          job.data.accessToken,
          Number(job.data.record.call_id),
        )
        .then(async (downloadUrl) => {
          // 8. Download record
          await this.pbxQueue.add('pbx_download', {
            record: job.data.record,
            accessToken: job.data.accessToken,
            downloadUrl,
          });
        })
        .catch(async (err) => {
          this.logger.error(`Download URL was refused PBX: ${err.message}`);
        });
    }
  }
}
