/**
 * UEBA Engine - User and Entity Behavior Analytics
 *
 * 基于权限审计日志进行行为分析和异常检测：
 * - 频繁被拒检测
 * - 异常访问模式检测
 * - 风险评分
 */

import { PermissionAuditRepository } from '../../repositories/PermissionAuditRepository';

export interface UEBAStats {
  userId: string;
  denyCount: number;
  denyRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastDenyAt?: string;
}

export interface AnomalyAlert {
  userId: string;
  alertType: 'frequent_denial' | 'unusual_resource_access' | 'off_hours_access' | 'cross_tenant_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
}

export class UEBAService {
  constructor(private auditRepo: PermissionAuditRepository) {}

  /**
   * 分析用户行为并返回统计信息
   */
  async analyzeUserBehavior(userId: string, hours = 24, tenantId?: string): Promise<UEBAStats | null> {
    const denies = await this.auditRepo.queryByUser(userId, 1000, tenantId);

    const recentDenies = denies.filter((d: any) => {
      const denyTime = new Date(d.evaluated_at);
      const hoursAgo = (Date.now() - denyTime.getTime()) / (1000 * 60 * 60);
      return hoursAgo <= hours + 0.001; // small epsilon for float precision
    });

    if (recentDenies.length === 0) return null;

    const denyCount = recentDenies.length;
    const uniqueResources = new Set(recentDenies.map((d: any) => d.resource_type)).size;

    // 风险评级
    let riskLevel: UEBAStats['riskLevel'] = 'low';
    if (denyCount >= 20 || uniqueResources >= 10) riskLevel = 'critical';
    else if (denyCount >= 10 || uniqueResources >= 5) riskLevel = 'high';
    else if (denyCount >= 5) riskLevel = 'medium';

    return {
      userId,
      denyCount,
      denyRate: hours > 0 ? denyCount / hours : denyCount,
      riskLevel,
      lastDenyAt: recentDenies[0]?.evaluated_at,
    };
  }

  /**
   * 获取高风险用户列表（租户隔离）
   */
  async getHighRiskUsers(hours = 24, limit = 10, tenantId?: string): Promise<UEBAStats[]> {
    const stats = await this.auditRepo.countDeniedByUser(hours, tenantId);
    const results: UEBAStats[] = [];

    for (const stat of stats.slice(0, limit)) {
      const userStats = await this.analyzeUserBehavior(stat.user_id, hours, tenantId);
      if (userStats && userStats.riskLevel !== 'low') {
        results.push(userStats);
      }
    }

    return results.sort((a, b) => {
      const levelOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return levelOrder[b.riskLevel] - levelOrder[a.riskLevel];
    });
  }

  /**
   * 生成异常告警（租户隔离）
   */
  async detectAnomalies(hours = 24, tenantId?: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    const stats = await this.auditRepo.countDeniedByUser(hours, tenantId);

    for (const stat of stats) {
      const userStats = await this.analyzeUserBehavior(stat.user_id, hours, tenantId);
      if (!userStats) continue;

      // 频繁被拒告警
      if (userStats.denyCount >= 10) {
        alerts.push({
          userId: stat.user_id,
          alertType: 'frequent_denial',
          severity: userStats.riskLevel,
          message: `用户 ${stat.user_id} 在过去 ${hours} 小时内被拒绝 ${userStats.denyCount} 次`,
          timestamp: new Date().toISOString(),
        });
      }

      // 非工作时间访问告警
      const denies = await this.auditRepo.queryByUser(stat.user_id, 100, tenantId);
      const offHoursDenies = denies.filter((d: any) => {
        const hour = new Date(d.evaluated_at).getUTCHours();
        return hour < 9 || hour >= 18;
      });

      if (offHoursDenies.length >= 3) {
        alerts.push({
          userId: stat.user_id,
          alertType: 'off_hours_access',
          severity: 'medium',
          message: `用户 ${stat.user_id} 在非工作时间有多次访问被拒`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }
}
