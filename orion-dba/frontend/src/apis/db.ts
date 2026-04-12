import { request, getApiBase, Res } from '@/config/request';

export interface Source {
  idc: string;
  source: string;
  ip: string;
  port: number;
  username: string;
  password: string;
  is_query: number;
  flow_id: number;
  source_id: string;
  exclude_db_list: string;
  insulate_word_list: string;
  principal: string;
  ca_file: string;
  cert: string;
  key_file: string;
  rule_id: number;
  db_type: number;
}

export interface DBParams {
  page: number;
  find: DBExpr;
}

export interface DBExpr {
  idc: string;
  source: string;
  ip: string;
  is_query: number;
}

export interface DBResp {
  data: Source[];
  page: number;
}

export interface RequestDB {
  tp: string;
  db: Source[] | Source;
  encrypt?: boolean;
}

const API_BASE = getApiBase();

export function getSourceList(args: DBParams) {
  return request.put<Res<DBResp>>(`${API_BASE}/manage/db`, args);
}

export function deleteSource(id: string) {
  return request.delete(`${API_BASE}/manage/db?source_id=${id}`);
}

export function createSource(args: RequestDB) {
  return request.post(`${API_BASE}/manage/db`, args);
}
