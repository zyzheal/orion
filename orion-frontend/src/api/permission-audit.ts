/**
 * Permission Audit API
 * 对接后端 /api/v1/permission-audit 端点
 */

import { api } from './client';

export interface AuditLogEntry {
  id?: number;
  user_id: string;
  tenant_id?: string;
  resource_type: string;
  resource_id?: string;
  action: string;
  decision: 'allow' | 'deny';
  decision_source: string;
  reason: string;
  evaluated_at?: string;
}

export interface AuditStats {
  user_id: string;
  count: string;
}

/**
 * 查询所有拒绝记录
 */
export async function queryDeniedLogs(limit = 100) {
  const res = await api.get<AuditLogEntry[]>('/permission-audit/denied', { params: { limit } });
  const data = res.data.data;
  return { data, total: data.length };
}

/**
 * 查询用户的审计日志
 */
export async function queryUserAuditLogs(userId: string, limit = 100) {
  const res = await api.get<AuditLogEntry[]>(`/permission-audit/user/${userId}`, { params: { limit } });
  const data = res.data.data;
  return { data, total: data.length };
}

/**
 * 按资源类型查询审计日志
 */
export async function queryResourceAuditLogs(resourceType: string, resourceId?: string, limit = 100) {
  const res = await api.get<AuditLogEntry[]>(`/permission-audit/resource/${resourceType}`, {
    params: { resourceId, limit },
  });
  const data = res.data.data;
  return { data, total: data.length };
}

/**
 * 统计用户被拒次数
 */
export async function queryDeniedStats(hours = 24) {
  const res = await api.get<AuditStats[]>('/permission-audit/stats/denied-by-user', { params: { hours } });
  return { data: res.data.data, hours };
}
