/**
 * UEBA API
 * 对接后端 /api/ueba 端点
 */

import { api } from './client';

export interface UEBAStats {
  userId: string;
  denyCount: number;
  denyRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastDenyAt?: string;
}

export interface AnomalyAlert {
  userId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
}

/**
 * 分析单个用户行为
 */
export async function analyzeUserBehavior(userId: string, hours = 24) {
  const res = await api.get(`/ueba/user/${userId}`, { params: { hours } });
  return res.data as { data: UEBAStats | null };
}

/**
 * 获取高风险用户列表
 */
export async function getHighRiskUsers(hours = 24, limit = 10) {
  const res = await api.get('/ueba/risks', { params: { hours, limit } });
  return res.data as { data: UEBAStats[]; total: number };
}

/**
 * 获取异常告警
 */
export async function getAnomalies(hours = 24) {
  const res = await api.get('/ueba/anomalies', { params: { hours } });
  return res.data as { data: AnomalyAlert[]; total: number };
}