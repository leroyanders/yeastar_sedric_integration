import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  ECallType,
  IInnerMessage,
  IOuterMessage,
  ERecordStatus,
  TErrorResponse,
} from './yeastar.interface';
import { YeastarService } from './yeastar.service';
import WebSocket from 'ws';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@WebSocketGateway()
export class YeastarGateway {
  private readonly logger = new Logger(YeastarGateway.name);
  private pbxBaseUrl = this.configService.get('YEASTAR_API_URL');
  private heartbeatIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
    @Inject(forwardRef(() => YeastarService))
    private yeastarService: YeastarService,
  ) {}

  @WebSocketServer() server: Server;
  private client: WebSocket = null;

  async initialize() {
    this.connectToWebSocket();
    this.logger.debug(
      `Connecting to Yeastar Gateway server with token: ${this.yeastarService.getStaticAccessToken()}`,
    );
  }

  private async sendMessage(data: any): Promise<void> {
    if (this.client.readyState !== WebSocket.OPEN) {
      this.logger.error(
        'Cannot send message: WebSocket is not open. Queuing message.',
      );
      await this.shutdown();
      return;
    }

    this.sendBasedOnType(data);
  }

  /**
   * Sends the provided data based on its type. If the data is a string,
   * it sends directly; otherwise, it converts to JSON string before sending.
   * @param data - The data to send.
   */
  private sendBasedOnType(data: string | object): void {
    if (typeof data === 'string') {
      this.client.send(data);
    } else {
      this.client.send(JSON.stringify(data));
    }
  }

  async shutdown() {
    this.logger.debug('Shutting down PBX WebSocket gateway...');

    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    if (this.client && this.client.readyState === WebSocket.OPEN)
      this.client.close();

    this.heartbeatIntervalId = null;
    this.logger.debug('PBX WebSocket gateway shut down successfully.');
  }

  private async processRecord(record: IInnerMessage) {
    if (!('type' in record)) return;
    if (
      record.status !== ERecordStatus.NOANSWER &&
      record.type === ECallType.OUTBOUND &&
      record.recording.trim().length > 0
    ) {
      const { id } = this.yeastarService.extractTimestampAndId(record.call_id);
      const value = await this.cacheManager.get(String(id));

      if (!value)
        await this.pbxQueue.add('processRecording', {
          record: { ...record, id },
        });
    }
  }

  private connectToWebSocket() {
    const accessToken = this.yeastarService.getStaticAccessToken();
    const wsUrl = `${this.pbxBaseUrl}/openapi/v1.0/subscribe?access_token=${accessToken}`;

    const registerEmitter = (event: string, cb: (data: any) => void) => {
      this.client.on(event, (data: any) => {
        cb(data);
      });
    };

    this.logger.debug('Attempting to connect to PBX WebSocket...');
    this.logger.debug(
      `Provided token to PBX: ${this.yeastarService.getStaticAccessToken()}`,
    );

    this.client = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
    });

    registerEmitter('open', async () => {
      await this.sendMessage({ topic_list: [30012] });
      this.heartbeatIntervalId = setInterval(async () => {
        await this.sendMessage('heartbeat');
      }, 5000);

      registerEmitter('message', async (data: string | null) => {
        if (data == null) return;
        if (data == 'heartbeat response') return;

        try {
          const json: IOuterMessage | TErrorResponse = JSON.parse(data);

          if ('errcode' in json && json.errcode !== 0) {
            this.logger.error('Error:', json);
          }

          if ('msg' in json) {
            const message: IOuterMessage = json as IOuterMessage;
            const record: IInnerMessage =
              typeof message.msg === 'string'
                ? JSON.parse(message.msg)
                : message.msg;

            await this.processRecord(record);
          }
        } catch (error) {
          this.logger.error('Failed to parse JSON:', error);
        }
      });
    });

    const errorProcessor = () => {
      this.logger.error(
        'Disconnected from PBX WebSocket, attempting to reconnect...',
      );
    };

    registerEmitter('close', () => {
      if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);

      this.logger.debug('Disconnected from PBX WebSocket.');
      this.heartbeatIntervalId = null;
    });

    registerEmitter('close', errorProcessor);
    registerEmitter('connect_error', errorProcessor);
    registerEmitter('connect_timeout', errorProcessor);
    registerEmitter('error', errorProcessor);
  }
}
