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
  // 拦截器已自动解包，res.data 直接是响应数据
  const data = (res.data as { data?: AuditLogEntry[] }).data ?? [];
  return { data, total: data.length };
}

/**
 * 查询用户的审计日志
 */
export async function queryUserAuditLogs(userId: string, limit = 100) {
  const res = await api.get<AuditLogEntry[]>(`/permission-audit/user/${userId}`, { params: { limit } });
  // 拦截器已自动解包，res.data 直接是响应数据
  const data = (res.data as { data?: AuditLogEntry[] }).data ?? [];
  return { data, total: data.length };
}

/**
 * 按资源类型查询审计日志
 */
export async function queryResourceAuditLogs(resourceType: string, resourceId?: string, limit = 100) {
  const res = await api.get<AuditLogEntry[]>(`/permission-audit/resource/${resourceType}`, {
    params: { resourceId, limit },
  });
  // 拦截器已自动解包，res.data 直接是响应数据
  const data = (res.data as { data?: AuditLogEntry[] }).data ?? [];
  return { data, total: data.length };
}

/**
 * 统计用户被拒次数
 */
export async function queryDeniedStats(hours = 24) {
  const res = await api.get<AuditStats[]>('/permission-audit/stats/denied-by-user', { params: { hours } });
  // 拦截器已自动解包，res.data 直接是响应数据
  return { data: (res.data as { data?: AuditStats[] }).data ?? [], hours };
}

// ─── UEBA Types & APIs ──────────────────────────────────────────────────────

/**
 * 后端 UEBAStats 的实际返回格式
 */
export interface UEBAStats {
  userId: string;
  denyCount: number;
  denyRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastDenyAt?: string;
}

/**
 * 后端 AnomalyAlert 的实际返回格式
 */
export interface AnomalyAlert {
  userId: string;
  alertType: 'frequent_denial' | 'unusual_resource_access' | 'off_hours_access' | 'cross_tenant_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
}

// 前端兼容别名
export type UEBAAnomaly = AnomalyAlert;
export type UEBARiskUser = UEBAStats;

/**
 * 分析单个用户行为 (UEBA)
 */
export async function analyzeUserBehavior(userId: string, hours = 24) {
  const res = await api.get<UEBAStats>(`/ueba/user/${userId}`, { params: { hours } });
  // 拦截器已自动解包，res.data 直接是响应数据
  return res.data as UEBAStats;
}

/**
 * 获取高风险用户列表 (UEBA)
 */
export async function getHighRiskUsers(hours = 24, limit = 10) {
  const res = await api.get<UEBARiskUser[]>('/ueba/risks', { params: { hours, limit } });
  // 拦截器已自动解包，res.data 直接是响应数据
  return res.data as UEBAStats[];
}

/**
 * 获取异常告警 (UEBA)
 */
export async function getAnomalies(hours = 24) {
  const res = await api.get<UEBAAnomaly[]>('/ueba/anomalies', { params: { hours } });
  // 拦截器已自动解包，res.data 直接是响应数据
  return res.data as AnomalyAlert[];
}
