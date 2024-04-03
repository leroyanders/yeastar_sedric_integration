import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, map } from 'rxjs';
import { get } from 'https';
import {
  IApiTokenResponse,
  IApiRecordDownloadResponse,
  IApiRecordsListResponse,
} from './yeastar.interface';
import axios, { AxiosResponse } from 'axios';
import { PbxEventsGateway } from '../pbx-events/pbx-events.gateway';
import { createWriteStream } from 'fs';
import { downloadPath } from '../utils/file-system';

@Injectable()
export class YeastarService {
  private readonly logger = new Logger(YeastarService.name);

  private accessToken: string = null;
  private refreshToken: string = null;
  private expireTime: number = null;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    private pbxGateway: PbxEventsGateway,
  ) {}

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
              this.initializeWebSocketGateway(data);

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

  async initializeWebSocketGateway(data: IApiTokenResponse) {
    await this.pbxGateway.initialize(data);
  }

  updateTokensAndScheduleNextRefresh(authData: IApiTokenResponse) {
    this.accessToken = authData.access_token;
    this.refreshToken = authData.refresh_token;
    this.expireTime = authData.access_token_expire_time * 100;

    // Schedule the next refresh slightly before the current token expires
    const refreshInterval = authData.access_token_expire_time * 100;

    this.logger.debug(`Token will be refreshed in: ${refreshInterval}`);
    setTimeout(async () => {
      await this.refreshTokenCycle();
      await this.initializeWebSocketGateway(authData);
    }, refreshInterval);

    return authData;
  }

  async refreshTokenCycle() {
    const refreshData: IApiTokenResponse = await this.refreshAccessToken(
      this.refreshToken,
    );

    this.logger.debug('Token was refreshed');
    console.log(refreshData);
    this.updateTokensAndScheduleNextRefresh(refreshData);
  }

  async getAccessToken(username: string, password: string) {
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/get_token`;

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
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/refresh_token`;
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
    accessToken: string,
    page?: number,
    pageSize?: number,
    sortBy?: string,
    orderBy?: string,
  ): Promise<IApiRecordsListResponse> {
    const params = new URLSearchParams({
      access_token: accessToken,
      ...(page && { page: page.toString() }),
      ...(pageSize && { page_size: pageSize.toString() }),
      ...(sortBy && { sort_by: sortBy }),
      ...(orderBy && { order_by: orderBy }),
    });

    const apiUrl = this.configService.get('YEASTAR_API_URL');
    const url = `${apiUrl}/recording/list?${params.toString()}`;

    try {
      return await firstValueFrom(
        this.httpService.get(url).pipe(
          map((response: AxiosResponse<IApiRecordsListResponse>) => {
            if (response.data.errcode === 0) {
              return response.data;
            } else {
              throw new Error(
                response.data.errmsg || 'Failed to fetch records list',
              );
            }
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
    accessToken: string,
    recordingId: number,
  ): Promise<string> {
    const params = new URLSearchParams({
      access_token: accessToken,
      id: recordingId.toString(),
    });

    const apiUrl = this.configService.get('YEASTAR_API_URL');
    const url = `${apiUrl}/recording/download?${params.toString()}`;

    try {
      return await firstValueFrom(
        this.httpService.get<IApiRecordDownloadResponse>(url).pipe(
          map((response) => {
            if (response.data.errcode === 0) {
              return `${apiUrl}/${response.data.download_resource_url}?access_token=${accessToken}`;
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

  async downloadRecording(
    accessToken: string,
    downloadUrl: string,
    savePath: string,
  ) {
    const apiUrl = this.configService.get('YEASTAR_API_URL');
    const url = `${apiUrl}${downloadUrl}?access_token=${accessToken}`;

    await new Promise((resolve, reject) => {
      const request = get(url, (response) => {
        if (response.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to download recording, status code: ${response.statusCode}`,
            ),
          );
        }

        this.logger.debug(`Downloading recording to: ${savePath}`);
        const fileStream = createWriteStream(downloadPath(savePath));

        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(downloadPath(savePath));
          this.logger.debug(`Recording downloaded at: ${savePath}`);
        });

        fileStream.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => reject(error));
    });

    return downloadPath(savePath);
  }
}
