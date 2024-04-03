import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import mime from 'mime-types';
import axios, { AxiosResponse } from 'axios';
import { IUploadUrlResponse } from './sedric.interface';

@Injectable()
export class SedricService {
  constructor(private configService: ConfigService) {}

  async uploadRecording(
    filePath: string,
    upload: IUploadUrlResponse,
  ): Promise<any> {
    // Create a stream from the file
    const stream = fs.createReadStream(filePath);
    // Determine the file's MIME type based on its extension, defaulting to 'application/octet-stream'
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    try {
      const response = await axios.put(upload.url, stream, {
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (response.status !== 200)
        return new Error('Failed to upload recording');

      return response.data;
    } catch (error) {
      throw error;
    }
  }
  async generateUploadUrl(dataObject: {
    user_id: string;
    prospect_id: string;
    unit_id: string;
    external_interaction_id?: string;
    recording_type: string;
    timestamp: string;
    topic: string;
    metadata?: any;
    api_key: string;
  }): Promise<any> {
    const apiUrl = this.configService.get('SEDRIC_API_URL');
    const url = `${apiUrl}/api_recording_uri`;
    const data = JSON.stringify(dataObject);
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: url,
      data: data,
    };

    try {
      const response: AxiosResponse<IUploadUrlResponse> =
        await axios.request(config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}
