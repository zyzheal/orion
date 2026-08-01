/**
 * APK Upload History API Service
 */
import { api } from './client';

export type ApkUploadStatus = 'pending' | 'uploading' | 'submitted' | 'published' | 'failed';

export interface ApkUploadRecord {
  id: string;
  tenantId: string;
  pipelineRunId?: string;
  pipelineId?: string;
  pipelineName?: string;
  market: string;
  packageName: string;
  versionName?: string;
  versionCode?: number;
  apkPath: string;
  status: ApkUploadStatus;
  uploadUrl?: string;
  uploadId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApkUploadHistoryListResponse {
  data: ApkUploadRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApkUploadHistoryQuery {
  limit?: number;
  offset?: number;
  market?: string;
  status?: ApkUploadStatus;
}

/**
 * List APK upload history
 */
export function getApkUploadHistory(_tenantId: string, query?: ApkUploadHistoryQuery) {
  const params: Record<string, string> = {};
  if (query?.limit) params.limit = query.limit.toString();
  if (query?.offset) params.offset = query.offset.toString();
  if (query?.market) params.market = query.market;
  if (query?.status) params.status = query.status;

  return api.get<ApkUploadHistoryListResponse>(`/api/v1/apk-upload-history`, { params });
}

/**
 * Get a single APK upload record
 */
export function getApkUploadRecord(id: string) {
  return api.get<{ data: ApkUploadRecord }>(`/api/v1/apk-upload-history/${id}`);
}

/**
 * Get recent upload failures
 */
export function getRecentFailures(_tenantId: string, limit?: number) {
  const params: Record<string, string> = {};
  if (limit) params.limit = limit.toString();

  return api.get<{ data: ApkUploadRecord[] }>(`/api/v1/apk-upload-history/recent-failures`, { params });
}

/**
 * Get upload statistics
 */
export function getApkUploadStats(_tenantId: string) {
  return api.get<{
    data: {
      total: number;
      published: number;
      failed: number;
      uploading: number;
      pending: number;
      submitted: number;
    };
  }>(`/api/v1/apk-upload-history/stats`);
}

/**
 * Market display names
 */
export const MARKET_NAMES: Record<string, string> = {
  huawei: '华为 AppGallery',
  xiaomi: '小米应用商店',
  oppo: 'OPPO 软件商店',
  vivo: 'VIVO 应用商店',
  honor: '荣耀应用市场',
  tencent: '腾讯应用宝',
  googleplay: 'Google Play',
  samsung: '三星 Galaxy Store',
  pgyer: '蒲公英',
  fir: 'fir.im',
};

/**
 * Status display configuration
 */
export const STATUS_CONFIG: Record<ApkUploadStatus, { color: string; text: string }> = {
  pending: { color: 'default', text: '等待中' },
  uploading: { color: 'processing', text: '上传中' },
  submitted: { color: 'warning', text: '待审核' },
  published: { color: 'success', text: '已发布' },
  failed: { color: 'error', text: '失败' },
};