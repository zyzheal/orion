/**
 * Degradation API Client
 *
 * 后端路由: /api/v1/degradation/*
 * 模块: degradation-routes.ts
 */

import { api } from './client';

// ==================== Types ====================

export interface ProviderRecoveryStats {
  providerId: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  degradedAt?: string;
  recoveredAt?: string;
  lastChecked: string;
}

export interface DegradationConfig {
  enabled: boolean;
  autoRecover: boolean;
  checkIntervalMs: number;
  failureThreshold: number;
  recoveryDelayMs: number;
}

export interface DegradationStatus {
  providers: ProviderRecoveryStats[];
  degradedProviders: string[];
  overallSuccessRate: number;
  config: DegradationConfig;
}

// ==================== API Methods ====================

/**
 * 获取降级状态总览
 * 后端直接返回 { stats, degradedProviders, config, overallSuccessRate }
 */
export async function getDegradationStatus(): Promise<DegradationStatus> {
  const res = await api.get<DegradationStatus>('/degradation/status');
  return res.data;
}

/**
 * 获取降级配置
 * 后端直接返回 DegradationConfig
 */
export async function getDegradationConfig(): Promise<DegradationConfig> {
  const res = await api.get<DegradationConfig>('/degradation/config');
  return res.data;
}

/**
 * 获取指定 Provider 的恢复统计
 * 后端直接返回 ProviderRecoveryStats
 */
export async function getProviderStats(providerId: string): Promise<ProviderRecoveryStats> {
  const res = await api.get<ProviderRecoveryStats>(`/degradation/stats/${encodeURIComponent(providerId)}`);
  return res.data;
}

/**
 * 获取所有降级 Provider
 * 后端返回 { success: true, data: providers } → 解包后为 string[]
 */
export async function getDegradedProviders(): Promise<string[]> {
  const res = await api.get<string[]>('/degradation/degraded');
  return res.data ?? [];
}

/**
 * 更新 Provider 成功率 (仅管理员)
 */
export async function updateProviderSuccessRate(providerId: string, successRate: number): Promise<void> {
  await api.post('/degradation/update-rate', { providerId, successRate });
}

/**
 * 获取所有 Provider 统计
 * 后端返回 { success: true, data: providers } → 解包后为 ProviderRecoveryStats[]
 */
export async function getAllProviderStats(): Promise<ProviderRecoveryStats[]> {
  const res = await api.get<ProviderRecoveryStats[]>('/degradation/stats');
  return res.data ?? [];
}

/**
 * 获取整体成功率
 * 后端返回 { success: true, data: successRate } → 解包后为 number
 */
export async function getOverallSuccessRate(): Promise<number> {
  const res = await api.get<number>('/degradation/success-rate');
  return res.data;
}
