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
  IApiTokenResponse,
} from './yeastar.interface';
import WebSocket from 'ws';

@WebSocketGateway()
export class YeastarGateway {
  private readonly logger = new Logger(YeastarGateway.name);
  private pbxBaseUrl = this.configService.get('YEASTAR_API_URL');
  private heartbeatIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private configService: ConfigService,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @WebSocketServer() server: Server;
  private client: WebSocket = null;

  async initialize(authData: IApiTokenResponse) {
    this.connectToWebSocket(authData);
  }

  private async sendMessage(data: any) {
    if (this.client.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        this.client.send(data);
      } else {
        this.client.send(JSON.stringify(data));
      }
    } else {
      this.logger.error(
        'Cannot send message: WebSocket is not open. Queuing message.',
      );

      await this.shutdown();
    }
  }

  async shutdown() {
    this.logger.debug('Shutting down PBX WebSocket gateway...');

    // Clear the heartbeat interval if it has been set
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    // Close the WebSocket client if it's not already closed
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.close();
    }

    this.logger.debug('PBX WebSocket gateway shut down successfully.');
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

    this.client = new WebSocket(wsUrl, {
      rejectUnauthorized: false,
    });

    registerEmitter('open', async () => {
      await this.sendMessage({ topic_list: [30012] });

      // Send heartbeat every 5 seconds
      this.heartbeatIntervalId = setInterval(async () => {
        await this.sendMessage('heartbeat');
      }, 5000);

      // Listen for messages
      registerEmitter('message', async (data: string | null) => {
        if (data === null) return;
        if (data === 'heartbeat response') {
          return this.logger.debug('Heartbeat received');
        }

        try {
          const json: IOuterMessage | TErrorResponse = JSON.parse(data);

          if ('errcode' in json && json.errcode === 0) {
            this.logger.log('Success:', json.errmsg);
          } else if ('errcode' in json) {
            this.logger.error('Error:', json);
          } else if ('msg' in json) {
            const message: IOuterMessage = json as IOuterMessage;

            let record: IInnerMessage;
            try {
              record =
                typeof message.msg === 'string'
                  ? JSON.parse(message.msg)
                  : message.msg;
            } catch (error) {
              this.logger.error('Failed to parse json.msg:', message.msg);
              return;
            }

            if ('type' in record) {
              await this.pbxQueue.add('pbx_process', { record: record });
            }
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
      if (this.heartbeatIntervalId) {
        clearInterval(this.heartbeatIntervalId);
        this.heartbeatIntervalId = null;
      }

      this.logger.debug('Disconnected from PBX WebSocket.');
    });

    registerEmitter('close', errorProcessor);
    registerEmitter('connect_error', errorProcessor);
    registerEmitter('connect_timeout', errorProcessor);
    registerEmitter('error', errorProcessor);
  }
}
