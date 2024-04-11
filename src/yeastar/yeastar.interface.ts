export interface IApiTokenResponse {
  errcode: number;
  errmsg: 'SUCCESS' | 'FAILURE';
  access_token_expire_time: number;
  access_token: string;
  refresh_token_expire_time: number;
  refresh_token: string;
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
  call_from_number: string;
  call_from_name: string;
  call_to_number: string;
  call_to_name: string;
}

export interface ApiDownloadRecordingUrlResponse {
  errcode: string;
  errmsg: string;
  file: string;
  download_resource_url: string;
}

export interface IOuterMessage {
  type: number;
  sn: string;
  msg: string;
}

export interface IInnerMessage {
  id: number;
  call_id: string;
  time_start: string;
  call_from: string;
  call_to: string;
  call_duration: number;
  talk_duration: number;
  src_trunk_name: string;
  dst_trunk_name: string;
  pin_code: string;
  status: string;
  type: string;
  recording: string;
  did_number: string;
  agent_ring_time: number;
}

export interface TErrorResponse {
  errcode: number;
  errmsg: string;
  invalid_param_list: TInvalidParam[];
}

interface TInvalidParam {
  value: string;
  validation_type: string;
}
