/**
 * Visor Audit API - 终端审计日志
 *
 * 2026-05-20: 新增，对接 orion-platform-service visor audit 路由
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface TerminalConnectLog {
  id: string;
  username: string;
  hostname: string;
  hostIp: string;
  connectTime: string;
  disconnectTime?: string;
  duration?: string;
  status: 'active' | 'closed' | 'terminated';
  clientIp: string;
  protocol: 'ssh' | 'telnet';
}

export interface TerminalSessionRecord {
  id: string;
  logId: string;
  timestamp: number;
  data: string;
  type: 'input' | 'output';
}

export interface TerminalFileLog {
  id: string;
  username: string;
  hostname: string;
  hostIp: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  operation: 'upload' | 'download';
  timestamp: string;
  status: 'success' | 'failed';
}

export interface AuditQueryParams {
  username?: string;
  hostname?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Terminal Connect Logs
// ============================================================================

export function listTerminalConnectLogs(params?: AuditQueryParams) {
  return api.get('/cmdb/terminal-audit/connect-logs', { params });
}

export function getTerminalConnectLog(id: string) {
  return api.get(`/cmdb/terminal-audit/connect-logs/${id}`);
}

export function terminateSession(id: string) {
  return api.post(`/cmdb/terminal-audit/connect-logs/${id}/terminate`);
}

// ============================================================================
// Terminal Session Replay
// ============================================================================

export function getSessionRecords(logId: string) {
  return api.get(`/cmdb/terminal-audit/connect-logs/${logId}/records`);
}

// ============================================================================
// Terminal File Logs
// ============================================================================

export function listTerminalFileLogs(params?: AuditQueryParams) {
  return api.get('/cmdb/terminal-audit/file-logs', { params });
}

export function getTerminalFileLog(id: string) {
  return api.get(`/cmdb/terminal-audit/file-logs/${id}`);
}
