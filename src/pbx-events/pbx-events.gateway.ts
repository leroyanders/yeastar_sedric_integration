import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { IInnerMessage, IOuterMessage } from './pbx-events.interface';
import { IApiTokenResponse } from '../yeastar/yeastar.interface';

@WebSocketGateway()
export class PbxEventsGateway {
  private readonly logger = new Logger(PbxEventsGateway.name);
  private pbxBaseUrl = this.configService.get('PBX_WEBSOCKET_URL');

  constructor(
    private configService: ConfigService,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @WebSocketServer() server: Server;
  private client: ReturnType<typeof io> = null;

  async initialize(authData: IApiTokenResponse) {
    this.logger.debug('Attempting to connect to PBX WebSocket...');
    this.logger.debug(`Provided token to PBX: ${authData.access_token}`);

    const registerEmitter = (event: string, cb: (data: any) => void) => {
      this.client.on(event, (data: any) => {
        cb(data);
      });
    };

    const sendMessage = (data: any) => {
      this.client.emit('message', data);
    };

    this.client = io(this.pbxBaseUrl, {
      path: '/openapi/v1.0/subscribe',
      secure: true,
      rejectUnauthorized: false,
      transports: ['websocket'],
      query: {
        access_token: authData.access_token,
      },
      extraHeaders: {
        HOST: '192.168.70.245:8088',
      },
    });

    registerEmitter('connect', () => {
      sendMessage(JSON.stringify({ topic_list: [30012] }));

      // Send heartbeat every 50 seconds
      setInterval(() => {
        sendMessage('heartbeat');
      }, 50000);

      // Listen for messages
      registerEmitter('message', async (data: any) => {
        this.logger.debug('Received message:', data);

        if (data.message !== 'heartbeat response') {
          const json = JSON.parse(data.message) as IOuterMessage;
          const record = (JSON.parse(json.msg) as IInnerMessage) || json.msg;

          // Publish only received records nothing else
          if ((record as IInnerMessage).type) {
            await this.pbxQueue.add('pbx_process', {
              record: record,
              accessToken: authData.access_token,
            });
          }
        }
      });
    });

    // Check for timeout / disconnect / errors
    registerEmitter('disconnect', () => {
      this.logger.error('Disconnected from PBX WebSocket');
    });

    registerEmitter('connect_error', (error) => {
      this.logger.error(error);
    });

    registerEmitter('connect_timeout', (error) => {
      this.logger.error(error);
    });

    registerEmitter('error', (error) => {
      this.logger.error(error);
    });
  }
}
