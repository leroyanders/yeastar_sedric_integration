export interface IApiTokenResponse {
  errcode: number; // Returned error code. 0: Succeed. Non-zero value: Failed.
  errmsg: 'SUCCESS' | 'FAILURE'; // Returned message. 'SUCCESS': Succeed. 'FAILURE': Failed.
  access_token_expire_time: number; // Access token expire time in seconds.
  access_token: string; // Credential of calling API interfaces. Required for all API requests.
  refresh_token_expire_time: number; // Refresh token expire time in seconds.
  refresh_token: string; // Refresh token used to obtain new access_token and refresh_token.
}

export interface IApiRecordsListResponse {
  errcode: number;
  errmsg: string;
  total_number: number;
  data: ICallRecord[];
}

export interface IApiRecordDownloadResponse {
  errcode: number;
  errmsg: string;
  file: string;
  download_resource_url: string;
}

export interface ICallRecord {
  id: number;
  time: string;
  uid: string;
  call_from: string;
  call_to: string;
  duration: number;
  size: number;
  call_type: string;
  file: string;
}

export interface ApiDownloadRecordingUrlResponse {
  errcode: string;
  errmsg: string;
  file: string;
  download_resource_url: string;
}
