import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, map } from 'rxjs';
import { get } from 'https';
import {
  IApiTokenResponse,
  IApiRecordDownloadResponse,
  IApiRecordsListResponse,
  ApiDownloadRecordingUrlResponse,
} from './yeastar.interface';
import axios, { AxiosResponse } from 'axios';
import { YeastarGateway } from './yeastar.gateway';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { downloadPath } from '../utils/fs';
import { dirname } from 'path';

@Injectable()
export class YeastarService {
  private readonly logger = new Logger(YeastarService.name);

  private accessToken: string = null;
  private refreshToken: string = null;
  private expireTime: number = null;
  private apiPath: string = 'openapi/v1.0';

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private pbxGateway: YeastarGateway,
  ) {}

  getStaticAccessToken() {
    return this.accessToken;
  }

  async initialize() {
    const username = this.configService.get('YEASTAR_API_USERNAME');
    const password = this.configService.get('YEASTAR_API_PASSWORD');

    // Auth
    if (!this.accessToken || !this.refreshToken) {
      try {
        await new Promise((resolve, reject) => {
          this.getAccessToken(username, password)
            .then((data) => {
              if (data.errcode !== 0) {
                reject(data.errmsg);
              }

              this.updateTokensAndScheduleNextRefresh(data);
              this.initializeWebSocketGateway();

              resolve(data);
            })
            .catch((err) => {
              reject(err);
            });
        });
      } catch (err) {
        throw new Error(err.message);
      }
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expireTime: this.expireTime,
    };
  }

  async initializeWebSocketGateway() {
    await this.pbxGateway.initialize();
  }

  extractTimestampAndId(input: string): { timestamp: number; id: number } {
    const parts = input.split('.');
    const timestamp = Number(parts[0]);
    const id = Number(parts[1]);

    return { timestamp, id };
  }

  async updateTokensAndScheduleNextRefresh(authData: IApiTokenResponse) {
    // Schedule the next refresh slightly before the current token expires
    const refreshInterval = authData.access_token_expire_time * 1000;

    this.accessToken = authData.access_token;
    this.refreshToken = authData.refresh_token;
    this.expireTime = authData.access_token_expire_time * 1000;
    this.logger.debug(`Token will be refreshed in: ${refreshInterval}`);

    setTimeout(async () => {
      await this.refreshTokenCycle();
      await this.pbxGateway.shutdown();
      await this.initializeWebSocketGateway();
    }, refreshInterval);

    return authData;
  }

  async refreshTokenCycle() {
    const refreshData: IApiTokenResponse = await this.refreshAccessToken(
      this.refreshToken,
    );
    await this.updateTokensAndScheduleNextRefresh(refreshData);
  }

  async getAccessToken(username: string, password: string) {
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/${this.apiPath}/get_token`;
    const config = {
      method: 'post',
      url: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'OpenAPI',
        Host: '192.168.70.245:8088',
      },
      data: {
        username,
        password,
      },
    };

    try {
      const response: AxiosResponse<IApiTokenResponse> =
        await axios.request(config);
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.expireTime = response.data.access_token_expire_time;

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string) {
    this.logger.debug('Refreshing access token');

    const username = this.configService.get('YEASTAR_API_USERNAME');
    const password = this.configService.get('YEASTAR_API_PASSWORD');
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/${this.apiPath}/refresh_token`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenAPI',
      Host: '192.168.70.245:8088',
    };

    const data = JSON.stringify({
      refreshToken: refreshToken,
      username: username,
      password: password,
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: apiUrl,
      headers,
      data: data,
    };

    try {
      const response: AxiosResponse<IApiTokenResponse> =
        await axios.request(config);
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.expireTime = response.data.access_token_expire_time;
      this.logger.debug('Access token refreshed...');

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async fetchRecordingList(
    page?: number,
    pageSize?: number,
    sortBy?: string,
    orderBy?: string,
  ): Promise<IApiRecordsListResponse> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      ...(page && { page: page.toString() }),
      ...(pageSize && { page_size: pageSize.toString() }),
      ...(sortBy && { sort_by: sortBy }),
      ...(orderBy && { order_by: orderBy }),
    });

    const apiUrl = this.configService.get('YEASTAR_API_URL');
    const url = `${apiUrl}/${this.apiPath}/recording/list?${params.toString()}`;

    try {
      return await firstValueFrom(
        this.httpService.get(url).pipe(
          map((response: AxiosResponse<IApiRecordsListResponse>) => {
            if (response.data.errcode === 0) {
              return response.data;
            }

            throw new Error(
              response.data.errmsg || 'Failed to fetch records list',
            );
          }),
          catchError((error) => {
            throw error;
          }),
        ),
      );
    } catch (error) {
      throw error;
    }
  }

  async getRecordingDownloadUrl(
    recordingId: string,
  ): Promise<ApiDownloadRecordingUrlResponse> {
    const params = new URLSearchParams({
      access_token: this.accessToken,
      file: recordingId.toString(),
    });

    const apiUrl = this.configService.get('YEASTAR_API_URL');
    const url = `${apiUrl}/${this.apiPath}/recording/download?${params.toString()}`;

    try {
      return await firstValueFrom(
        this.httpService.get<IApiRecordDownloadResponse>(url).pipe(
          map(async (response) => {
            if (response.data.errcode === 0) {
              return {
                errcode: response.data.errmsg,
                errmsg: response.data.errmsg,
                file: response.data.file,
                download_resource_url: `${apiUrl}${response.data.download_resource_url}?access_token=${this.accessToken}`,
              };
            } else {
              throw new Error(response.data.errmsg);
            }
          }),
          catchError((error) => {
            throw new Error(error.message || 'An error occurred');
          }),
        ),
      );
    } catch (error) {
      throw error;
    }
  }

  async downloadRecording(downloadUrl: ApiDownloadRecordingUrlResponse) {
    const fullPath = downloadPath(downloadUrl.file);
    const directory = dirname(fullPath);

    // Check if the directory path is not empty and the directory does not exist
    if (directory && !existsSync(directory))
      mkdirSync(directory, { recursive: true });

    await new Promise((resolve, reject) => {
      const request = get(downloadUrl.download_resource_url, (response) => {
        if (response.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to download recording, status code: ${response.statusCode}`,
            ),
          );
        } else {
          const fileStream = createWriteStream(fullPath);

          // Pipe stream to response
          response.pipe(fileStream);

          // Handle for stream write end
          fileStream.on('finish', () => {
            this.logger.debug(`Recording downloaded at: ${fullPath}`);
            this.logger.debug(`Downloading recording to: ${fullPath}`);

            // Close stream
            fileStream.close();
            // Resolve full path of saved file
            resolve(fullPath);
          });

          fileStream.on('error', (error) => {
            reject(error);
          });
        }
      });

      request.on('error', (error) => reject(error));
    });

    return fullPath;
  }
}
