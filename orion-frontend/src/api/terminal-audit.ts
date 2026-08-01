/**
 * Terminal Audit API Service
 * - Terminal connect logs (who connected to which host, when)
 * - File transfer logs (upload/download history)
 * - Audit stats
 */
import apiClient from './client';

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
}

export interface TerminalFileLog {
  id: string;
  username: string;
  hostname: string;
  filePath: string;
  fileName: string;
  fileSize: string;
  operation: 'upload' | 'download';
  timestamp: string;
  status: 'success' | 'failed';
}

export interface TerminalAuditStats {
  totalConnectLogs: number;
  activeSessions: number;
  totalFileTransfers: number;
}

export interface ConnectLogListParams {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'closed' | 'terminated';
}

export interface FileLogListParams {
  page?: number;
  pageSize?: number;
  operation?: 'upload' | 'download';
  status?: 'success' | 'failed';
}

// ============================================================================
// Connect Logs
// ============================================================================

export const getConnectLogs = async (params?: ConnectLogListParams) => {
  const response = await apiClient.get('/api/cmdb/terminal-audit/connect-logs', { params });
  return response.data as {
    success: boolean;
    data: TerminalConnectLog[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export const getConnectLog = async (id: string) => {
  const response = await apiClient.get(`/api/cmdb/terminal-audit/connect-logs/${id}`);
  return response.data as { success: boolean; data: TerminalConnectLog };
};

// ============================================================================
// File Transfer Logs
// ============================================================================

export const getFileLogs = async (params?: FileLogListParams) => {
  const response = await apiClient.get('/api/cmdb/terminal-audit/file-logs', { params });
  return response.data as {
    success: boolean;
    data: TerminalFileLog[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export const getFileLog = async (id: string) => {
  const response = await apiClient.get(`/api/cmdb/terminal-audit/file-logs/${id}`);
  return response.data as { success: boolean; data: TerminalFileLog };
};

// ============================================================================
// Stats
// ============================================================================

export const getTerminalAuditStats = async () => {
  const response = await apiClient.get('/api/cmdb/terminal-audit/stats');
  return response.data as { success: boolean; data: TerminalAuditStats };
};
