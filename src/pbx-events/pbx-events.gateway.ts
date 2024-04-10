import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Logger } from '@nestjs/common';
import {
  IInnerMessage,
  IOuterMessage,
  TErrorResponse,
} from './pbx-events.interface';
import { IApiTokenResponse } from '../yeastar/yeastar.interface';
import WebSocket from 'ws';

@WebSocketGateway()
export class PbxEventsGateway {
  private readonly logger = new Logger(PbxEventsGateway.name);
  private pbxBaseUrl = this.configService.get('PBX_WEBSOCKET_URL');
  private reconnectInterval: number = 5000;

  constructor(
    private configService: ConfigService,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @WebSocketServer() server: Server;
  private client: WebSocket = null;

  async initialize(authData: IApiTokenResponse) {
    this.connectToWebSocket(authData);
  }

  private connectToWebSocket(authData: IApiTokenResponse) {
    const wsUrl = `${this.pbxBaseUrl}/openapi/v1.0/subscribe?access_token=${authData.access_token}`;

    const registerEmitter = (event: string, cb: (data: any) => void) => {
      this.client.on(event, (data: any) => {
        cb(data);
      });
    };

    this.logger.debug('Attempting to connect to PBX WebSocket...');
    this.logger.debug(`Provided token to PBX: ${authData.access_token}`);

    const sendMessage = (data: any) => {
      if (typeof data === 'string') {
        this.client.send(data);
      } else {
        this.client.send(JSON.stringify(data));
      }
    };

    this.client = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
    });

    registerEmitter('open', () => {
      sendMessage({ topic_list: [30012] });

      // Send heartbeat every 50 seconds
      setInterval(() => {
        sendMessage('heartbeat');
      }, 50000);

      // Listen for messages
      registerEmitter('message', async (data: string) => {
        this.logger.debug('Received message:', data);

        if (data !== 'heartbeat response' && typeof data === 'object') {
          const json = (data as IOuterMessage) || (data as TErrorResponse);

          if ('errcode' in json) {
            this.logger.error(json);
          }

          if ('msg' in json) {
            const record = json.msg;

            // Publish only received records nothing else
            if ((record as unknown as IInnerMessage).type) {
              await this.pbxQueue.add('pbx_process', {
                record: record,
                accessToken: authData.access_token,
              });
            }
          }
        }
      });
    });

    const attemptReconnect = () => {
      this.logger.error(
        'Disconnected from PBX WebSocket, attempting to reconnect...',
      );
      setTimeout(
        () => this.connectToWebSocket(authData),
        this.reconnectInterval,
      );
    };

    registerEmitter('close', attemptReconnect);
    registerEmitter('connect_error', attemptReconnect);
    registerEmitter('connect_timeout', attemptReconnect);
    registerEmitter('error', attemptReconnect);
  }
}
