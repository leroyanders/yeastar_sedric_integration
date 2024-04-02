export interface IOuterMessage {
  type: number;
  sn: string;
  msg: string;
}

export interface IInnerMessage {
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
