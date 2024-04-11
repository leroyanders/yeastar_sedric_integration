import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import mime from 'mime-types';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';
import { ISedricTeam, IUploadUrlResponse } from './sedric.interface';
import moment from 'moment';

@Injectable()
export class SedricService {
  constructor(private configService: ConfigService) {}

  private teams: ISedricTeam[] = [
    {
      name: 'team-1',
      members: Array.from(
        new Set([
          202, 309, 312, 313, 314, 315, 316, 2041, 2038, 2035, 2037, 2064, 2034,
          2033, 317, 318, 319, 214, 240, 2023, 2066, 2027, 2036, 2067,
        ]),
      ),
    },
    {
      name: 'team-2',
      members: Array.from(
        new Set([
          2140, 2121, 2051, 3027, 2153, 2151, 2046, 2007, 2114, 2022, 2000,
          2154, 2060, 2062, 3053, 3055, 2039, 2001, 2020, 2021, 2049, 2024,
          2025, 2159, 2175, 2141, 2147, 2123, 2150, 2146, 2178, 3041, 2124,
          2170, 2179, 2003, 2004, 2043, 2044, 2045, 2032, 3039, 2189, 2048,
          2129, 3001, 2111, 4022, 2047, 2068, 2069, 2050, 2071,
        ]),
      ),
    },
    {
      name: 'team-3',
      members: Array.from(
        new Set([
          2038, 2107, 2172, 2155, 2162, 3013, 2013, 2012, 2070, 2053, 2054,
          2055, 2056, 2057, 2108, 2102, 2144, 2188, 2135, 2058, 2059, 2061,
          2063,
        ]),
      ),
    },
  ];

  findTeamByName(id: string): string {
    for (const team of this.teams) {
      if (team.members.includes(Number(id))) {
        return `evest-org-${team.name}-ar`;
      }
    }

    return 'evest-org-team-2-ar';
  }

  parseUserId(input: string): {
    user_id: string;
    metadata: { extension: string };
  } {
    // Regular expression to extract the user ID and extension
    const regex = /^(?<userId>[^<]+)<(?<extension>[^>]+)>$/;
    const match = input.match(regex);

    if (!match || !match.groups) {
      return {
        user_id: input,
        metadata: { extension: input },
      };
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
          ...(upload.headers as unknown as AxiosHeaders),
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
