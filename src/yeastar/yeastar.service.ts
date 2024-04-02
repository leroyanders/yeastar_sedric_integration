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
import { AxiosResponse } from 'axios';
import { saveFile } from '../utils/file-system';

@Injectable()
export class YeastarService {
  private readonly logger = new Logger(YeastarService.name);

  private accessToken: string = null;
  private refreshToken: string = null;
  private expireTime: number = null;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async initialize() {
    const username = this.configService.get('YEASTAR_API_USERNAME');
    const password = this.configService.get('YEASTAR_API_PASSWORD');

    // Auth
    if (!this.accessToken || !this.refreshToken) {
      try {
        const authData: IApiTokenResponse = await this.getAccessToken(
          username,
          password,
        );

        this.updateTokensAndScheduleNextRefresh(authData);
      } catch (err) {
        this.logger.debug('Failed to get initial access token:', err.message);
      }
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expireTime: this.expireTime,
    };
  }

  updateTokensAndScheduleNextRefresh(authData: IApiTokenResponse) {
    this.accessToken = authData.access_token;
    this.refreshToken = authData.refresh_token;
    this.expireTime = authData.access_token_expire_time;

    // Schedule the next refresh slightly before the current token expires
    const refreshInterval = authData.access_token_expire_time;
    setTimeout(() => this.refreshTokenCycle(), refreshInterval);

    return authData;
  }

  async refreshTokenCycle() {
    try {
      const refreshData: IApiTokenResponse = await this.refreshAccessToken(
        this.refreshToken,
      );
      this.updateTokensAndScheduleNextRefresh(refreshData);
    } catch (err) {
      this.logger.error(
        'Failed to refresh token, attempting to reinitialize:',
        err,
      );

      // If refresh fails, attempt to reinitialize
      this.initialize().catch((initializeErr) =>
        this.logger.error(
          'Failed to reinitialize after refresh failure:',
          initializeErr,
        ),
      );
    }
  }

  async getAccessToken(username: string, password: string) {
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/get_token`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenAPI',
    };

    try {
      return await firstValueFrom(
        this.httpService.post(apiUrl, { username, password }, { headers }).pipe(
          map((response) => {
            const authResponse = response.data as IApiTokenResponse;

            if (authResponse.errcode !== 0) {
              throw new Error(authResponse.errmsg);
            }

            return authResponse;
          }),
        ),
      );
    } catch (err) {
      throw new Error(`Authentication failed: ${err.message}`);
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const apiUrl = `${this.configService.get('YEASTAR_API_URL')}/refresh_token`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'OpenAPI', // As required by Yeastar API
    };

    try {
      return await firstValueFrom(
        this.httpService
          .post(apiUrl, { refresh_token: refreshToken }, { headers })
          .pipe(
            map((response) => {
              const authResponse = response.data as IApiTokenResponse;

              if (authResponse.errcode !== 0) {
                throw new Error(authResponse.errmsg);
              }

              return authResponse;
            }),
          ),
      );
    } catch (err) {
      throw new Error(`Authentication failed: ${err}`);
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
              return response.data.download_resource_url;
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
      const request = get(url, async (response) => {
        if (response.statusCode !== 200) {
          return reject(
            new Error(
              `Failed to download recording, status code: ${response.statusCode}`,
            ),
          );
        }

        try {
          resolve(await saveFile(response, savePath));
        } catch (error) {
          reject(error);
        }
      });

      request.on('error', (error) => reject(error));
    });

    return savePath;
  }
}
