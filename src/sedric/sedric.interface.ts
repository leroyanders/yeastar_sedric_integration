export interface IUploadUrlResponse {
  url: string;
  headers: UploadUrlHeaders;
  data: UploadData;
}

export type ISedricTeam = {
  name: string;
  members: string[];
};

interface UploadUrlHeaders {
  'content-type': string;
  'x-goog-meta-id': string;
  'x-goog-meta-topic': string;
  'x-goog-meta-timestamp': string;
  'x-goog-meta-user_id': string;
  'x-goog-meta-prospect_id': string;
  'x-goog-meta-recording_type': string;
  'x-goog-meta-organization_id': string;
  'x-goog-meta-external_interaction_id': string;
  'x-goog-meta-unit_id': string;
  'x-goog-meta-language': string;
  'x-goog-meta-audit': string;
  'x-goog-meta-tasks': string;
  'x-goog-meta-metadata': string;
  'x-goog-meta-kind': string;
  'x-goog-meta-status': string;
}

interface UploadData {
  user_id: string;
  unit_id: string;
  interaction_id: string;
  external_interaction_id: string;
  prospect_id: string;
}
