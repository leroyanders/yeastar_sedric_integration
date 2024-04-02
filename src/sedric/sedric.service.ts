import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { map } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import fs from 'fs';
import mime from 'mime-types';
import axios from 'axios';

@Injectable()
export class SedricService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async uploadRecording(filePath: string, uploadUrl: string): Promise<any> {
    // Create a stream from the file
    const stream = fs.createReadStream(filePath);

    // Determine the file's MIME type based on its extension, defaulting to 'application/octet-stream'
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    try {
      const response = await axios.put(uploadUrl, stream, {
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
  async generateUploadUrl(data: {
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

    try {
      return await firstValueFrom(
        this.httpService.post(url, data).pipe(
          map((response) => response.data),
          catchError((err) => {
            throw new Error(err.message || 'Failed to generate upload URL');
          }),
        ),
      );
    } catch (error) {
      throw error;
    }
  }
}
