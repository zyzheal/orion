/**
 * Inception (SQL Audit Engine) API Service
 * SQL parsing, formatting, auditing, and execution via Inception engine
 */
import { api } from './client';

export interface SqlAuditResult {
  success: boolean;
  warnings: Array<{ level: string; message: string; line: number }>;
  errors: Array<{ level: string; message: string; line: number }>;
  sql: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SqlParseResult {
  success: boolean;
  sql: string;
  formatted: string;
  type: string;
}

export interface SqlExecuteResult {
  success: boolean;
  result?: Record<string, unknown>[];
  message?: string;
  affectedRows?: number;
}

export interface InceptionStatus {
  connected: boolean;
  host: string;
  port: number;
}

export interface AuditRecord {
  id: string;
  sql: string;
  status: 'passed' | 'failed' | 'warning';
  riskLevel: string;
  createdAt: string;
  executedBy: string;
}

export const inceptionApi = {
  health: () => api.get('/api/inception/health'),
  status: () => api.get('/api/inception/status'),
  audit: (sql: string, database?: string) =>
    api.post<SqlAuditResult>('/api/inception/audit', { sql, database }),
  parse: (sql: string) =>
    api.post<SqlParseResult>('/api/inception/parse', { sql }),
  execute: (sql: string, database?: string, dryRun?: boolean) =>
    api.post<SqlExecuteResult>('/api/inception/execute', {
      sql,
      database,
      dryRun: dryRun || false,
    }),
  listDatabases: () => api.get<{ databases: string[] }>('/api/inception/databases'),
  history: (params?: { page?: number; limit?: number }) =>
    api.get<{ records: AuditRecord[]; total: number }>('/api/inception/history', {
      params,
    }),
};
