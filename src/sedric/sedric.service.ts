import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import mime from 'mime-types';
import axios, { AxiosResponse } from 'axios';
import { IUploadUrlResponse } from './sedric.interface';
import moment from 'moment';

@Injectable()
export class SedricService {
  constructor(private configService: ConfigService) {}

  parseUserId(input: string): {
    user_id: string;
    metadata: { extension: string };
  } {
    // Regular expression to extract the user ID and extension
    const regex = /^(?<userId>[^<]+)<(?<extension>[^>]+)>$/;
    const match = input.match(regex);

    if (!match || !match.groups) {
      throw new Error('Invalid input format');
    }

    // Extracting user ID and extension using named capturing groups
    const { userId, extension } = match.groups;

    return {
      user_id: userId.trim(), // Trim to remove any leading/trailing whitespace
      metadata: { extension: extension.trim() }, // No need for angle brackets around extension
    };
  }

  formatDateString(dateStr: string): string {
    const formats = [
      'DD/MM/YYYY hh:mm:ss A', // e.g., 27/02/2024 12:27:26 PM
      moment.ISO_8601, // ISO format
    ];

    // Parse the date string using the specified formats
    const parsedDate = moment(dateStr, formats);

    if (!parsedDate.isValid()) {
      throw new Error(`Unable to parse date: ${dateStr}`);
    }

    // Convert to UTC and format
    return parsedDate.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
  }

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
          ...upload.headers,
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
  }): Promise<IUploadUrlResponse> {
    const apiUrl = this.configService.get('SEDRIC_API_URL');
    const url = `${apiUrl}/api_recording_uri`;
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: url,
      data: JSON.stringify({
        ...dataObject,
        timestamp: this.formatDateString(dataObject.timestamp),
      }),
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
