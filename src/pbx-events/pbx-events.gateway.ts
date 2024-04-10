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
  private pbxBaseUrl = this.configService.get('YEASTAR_API_URL');
  private reconnectInterval: number = 5000;
  private messageQueue: any[] = [];
  private isReconnecting = false;

  constructor(
    private configService: ConfigService,
    @InjectQueue('pbx') private readonly pbxQueue: Queue,
  ) {}

  @WebSocketServer() server: Server;
  private client: WebSocket = null;

  async initialize(authData: IApiTokenResponse) {
    this.connectToWebSocket(authData);
  }

  private async reconnectAndSend(data: IApiTokenResponse) {
    let attempts = 0;
    const maxAttempts = 5;

    // Function to wait for a specified amount of time
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (!this.isReconnecting && attempts < maxAttempts) {
      this.isReconnecting = true;
      this.logger.error(
        `Attempting to reconnect WebSocket... Attempt ${attempts + 1}/${maxAttempts}`,
      );

      try {
        // Reconnect logic
        this.connectToWebSocket(data);

        // If the connection is successful, break the loop
        if (this.client.readyState === WebSocket.OPEN) {
          this.logger.log('WebSocket reconnected successfully.');

          // Dequeue and send all queued messages
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            await this.sendMessage(message, data);
          }

          break; // Exit the loop after successful reconnection
        }
      } catch (error) {
        this.logger.error('Reconnection attempt failed.', error);
      } finally {
        this.isReconnecting = false;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await delay(180000); // 3 minutes in milliseconds
      }
    }

    if (attempts >= maxAttempts) {
      this.logger.error(
        'Max reconnection attempts reached. Unable to reconnect WebSocket.',
      );
    }
  }

  private async sendMessage(data: any, authData: IApiTokenResponse) {
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

      // Add the message to the queue
      this.messageQueue.push(data);

      // Attempt to reconnect and then resend messages
      await this.reconnectAndSend(authData);
    }
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
      await this.sendMessage({ topic_list: [30012] }, authData);

      // Send heartbeat every 50 seconds
      setInterval(async () => {
        await this.sendMessage('heartbeat', authData);
      }, 50000);

      // Listen for messages
      registerEmitter('message', async (data: string | object) => {
        this.logger.debug('Received message:', data, typeof data);

        // Ensure data is neither null nor a heartbeat response
        if (
          data !== 'heartbeat response' &&
          data !== null &&
          typeof data === 'object'
        ) {
          let json: IOuterMessage | TErrorResponse;

          // Safely handle data assuming it's an object
          if ('errcode' in data) {
            json = data as TErrorResponse;
            this.logger.error('Error:', json);
          } else if ('msg' in data) {
            json = data as IOuterMessage;

            let record: IInnerMessage;
            try {
              record =
                typeof json.msg === 'string' ? JSON.parse(json.msg) : json.msg;
            } catch (error) {
              this.logger.error('Failed to parse json.msg:', json.msg);
              return;
            }

            if ('type' in record) {
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
