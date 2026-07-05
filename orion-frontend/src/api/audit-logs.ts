/**
 * Pipeline Audit Log API Client
 *
 * Backend routes: orion-platform-service/src/api/pipeline-audit-log-routes.ts
 * Backend service: PipelineAuditLogService
 */

import { api } from './client';

// ==================== 类型定义 ====================

export type AuditAction =
  | 'stage.start' | 'stage.complete' | 'stage.skip' | 'stage.fail'
  | 'task.start' | 'task.complete' | 'task.fail' | 'task.skip'
  | 'approval.request' | 'approval.approve' | 'approval.reject'
  | 'trigger.fire'
  | 'run.create' | 'run.cancel' | 'run.complete';

export type AuditOutcome = 'success' | 'failed' | 'pending';

export interface PipelineAuditLog {
  id: string;
  tenantId: string;
  runId: string;
  stageId?: string;
  taskId?: string;
  action: AuditAction;
  actor: string;
  outcome: AuditOutcome;
  durationMs?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateAuditLogInput {
  runId: string;
  action: AuditAction;
  actor: string;
  outcome: AuditOutcome;
  stageId?: string;
  taskId?: string;
  durationMs?: number;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilter {
  runId?: string;
  stageId?: string;
  taskId?: string;
  action?: AuditAction;
  actor?: string;
  outcome?: AuditOutcome;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailEntry {
  id: string;
  runId: string;
  action: AuditAction;
  actor: string;
  outcome: AuditOutcome;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
  stageId?: string;
  taskId?: string;
}

// ==================== API 方法 ====================

// POST /api/v1/audit-logs — 记录单条 (内部接口)
export function recordAuditLog(data: CreateAuditLogInput) {
  return api.post<PipelineAuditLog>('/api/v1/audit-logs', data);
}

// POST /api/v1/audit-logs/batch — 批量记录 (内部接口)
export function batchRecordAuditLogs(logs: CreateAuditLogInput[]) {
  return api.post<PipelineAuditLog[]>('/api/v1/audit-logs/batch', { logs });
}

// GET /api/v1/audit-logs — 查询审计日志
export function getAuditLogs(params?: AuditLogFilter) {
  return api.get<{ data: PipelineAuditLog[]; total?: number }>('/api/v1/audit-logs', { params });
}

// GET /api/v1/audit-logs/runs/:runId/audit-trail — 获取运行完整审计轨迹
export function getRunAuditTrail(runId: string, limit?: number) {
  return api.get<AuditTrailEntry[]>(`/api/v1/audit-logs/runs/${runId}/audit-trail`, {
    params: limit ? { limit: String(limit) } : undefined,
  });
}

// POST /api/v1/audit-logs/cleanup — 清理过期日志 (管理员)
export function cleanupAuditLogs(retentionDays?: number) {
  return api.post<{ deleted: number }>('/api/v1/audit-logs/cleanup', { retentionDays });
}
