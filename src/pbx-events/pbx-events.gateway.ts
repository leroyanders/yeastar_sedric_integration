import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { IInnerMessage, IOuterMessage } from './pbx-events.interface';
import { YeastarService } from '../yeastar/yeastar.service';

@WebSocketGateway()
export class PbxEventsGateway {
  private readonly logger = new Logger(PbxEventsGateway.name);
  private pbxDomain = this.configService.get('PBX_WEBSOCKET_URL');
  private accessToken = null;
  private pbxUrl = null;

  constructor(
    private configService: ConfigService,
    private yeastarService: YeastarService,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @WebSocketServer() server: Server;
  private client: ReturnType<typeof io> = io(this.pbxUrl, {
    transports: ['websocket'],
  });

  private registerEmitter(event: string, cb: (data: any) => void): void {
    this.client.on(event, (data: any) => {
      cb(data);
    });
  }

  private sendMessage(data: any) {
    this.client.emit('message', data);
  }

  private registerTroubleshoot(): void {
    this.registerEmitter('disconnect', () => {
      this.logger.error('Disconnected from PBX WebSocket');
    });

    this.registerEmitter('connect_error', (error) => {
      this.logger.error(`Connect Error: ${error.message}`);
    });

    this.registerEmitter('connect_timeout', (timeout) => {
      this.logger.error(`Connect Timeout: ${timeout.message}`);
    });

    this.registerEmitter('error', (error) => {
      this.logger.error(`Error Event: ${error.message}`);
    });
  }

  async initialize(accessToken: string, expireTime: number) {
    this.logger.debug('Attempting to connect to PBX WebSocket...');

    this.accessToken = accessToken;
    this.pbxUrl = `${this.pbxDomain}=${this.accessToken}`;

    // Auto-update accessToken for PBX
    setTimeout(async () => {
      this.yeastarService
        .initialize()
        .then(async (update) => {
          this.accessToken = update.accessToken;
          await this.initialize(accessToken, update.expireTime);
        })
        .catch((err) => {
          this.logger.error(
            `Error Initializing PBX WebSocket Server: ${err.message}`,
          );
        });
    }, expireTime);

    this.registerEmitter('connect', () => {
      this.sendMessage(JSON.stringify({ topic_list: [30012] }));

      // Send heartbeat every 50 seconds
      setInterval(() => {
        this.sendMessage('heartbeat');
      }, 50000);

      // Listen for messages
      this.registerEmitter('message', async (data: any) => {
        this.logger.debug('Received message:', data);

        if (data.message !== 'heartbeat response') {
          const json = JSON.parse(data.message) as IOuterMessage;
          const record = (JSON.parse(json.msg) as IInnerMessage) || json.msg;

          // Publish only received records nothing else
          if ((record as IInnerMessage).type) {
            await this.pbxQueue.add('pbx_process', {
              record: record,
              accessToken,
            });
          }
        }
      });
    });

    // Check for timeout / disconnect / errors
    this.registerTroubleshoot();
  }
}
