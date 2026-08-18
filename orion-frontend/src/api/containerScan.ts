/**
 * Container Image Security Scan API Service
 *
 * Backend: GET /api/v1/ai/security/scans
 *           GET /api/v1/ai/security/scans/:id
 *           POST /api/v1/ai/security/scans
 *
 * Maps backend scan results to frontend ImageScanRecord.
 */
import { api } from './client';

export type ScanStatus = 'passed' | 'vulnerable' | 'failed';

export interface ImageScanRecord {
  key: string;
  image: string;
  tag: string;
  scanTime: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  status: ScanStatus;
  engine: string;
}

export interface ScanListParams {
  user_id?: string;
  start_time?: string;
  end_time?: string;
  page?: number;
  page_size?: number;
}

export interface ScanListResponse {
  data: ImageScanRecord[];
  meta: { total: number };
}

export function listContainerScans(params?: ScanListParams) {
  return api.get<ScanListResponse>('/api/v1/ai/security/scans', { params });
}

export function getContainerScan(id: string) {
  return api.get<{ data: ImageScanRecord }>(`/api/v1/ai/security/scans/${id}`);
}

export interface RunScanParams {
  image?: string;
  tag?: string;
  engine?: string;
  policy_id?: string;
}

export function runContainerScan(data: RunScanParams) {
  return api.post<{ data: { id: string; status: string } }>('/api/v1/ai/security/scans', data);
}