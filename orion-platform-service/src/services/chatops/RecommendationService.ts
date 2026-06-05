/**
 * Recommendation Service — 推荐面板聚合服务
 *
 * B-5: 使用 DataProvider 接口模式
 * Phase 1a: RealDataProvider 查询真实数据库表
 *           MockDataProviderImpl 保留但注释掉，便于回滚
 */

import { ChatOpsRecommendation } from './EventSubscriber';
import { DatabasePool } from '../database';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LRecommendation-LService' });

// ==================== DataProvider 接口 ====================

export interface MockAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  resource: string;
}

export interface MockBlockedPipeline {
  pipelineId: string;
  message: string;
  status: 'blocked';
}

export interface MockFailedSelfHealing {
  policyId: string;
  policyName: string;
  error: string;
  service: string;
}

export interface MockCostAnomaly {
  id: string;
  service: string;
  anomaly: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface DataProvider {
  getActiveAlerts(): Promise<MockAlert[]>;
  getBlockedPipelines(): Promise<MockBlockedPipeline[]>;
  getFailedSelfHealingExecutions(): Promise<MockFailedSelfHealing[]>;
  getCostAnomalies(): Promise<MockCostAnomaly[]>;
}

// ==================== Mock 实现 (保留用于回滚) ====================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
/*
export class MockDataProviderImpl implements DataProvider {
  async getActiveAlerts(): Promise<MockAlert[]> {
    return [
      { id: 'alert-1', severity: 'critical', title: 'CPU 使用率 > 90%', message: 'node-3 CPU 持续告警', resource: 'node-3' },
      { id: 'alert-2', severity: 'warning', title: '内存使用率 > 80%', message: 'api-gateway 内存增长', resource: 'api-gateway' },
    ];
  }

  async getBlockedPipelines(): Promise<MockBlockedPipeline[]> {
    return [
      { pipelineId: '42', message: '等待人工确认', status: 'blocked' },
    ];
  }

  async getFailedSelfHealingExecutions(): Promise<MockFailedSelfHealing[]> {
    return [
      { policyId: 'pol-1', policyName: 'Pod 重启策略', error: '重试次数耗尽', service: 'payment-service' },
    ];
  }

  async getCostAnomalies(): Promise<MockCostAnomaly[]> {
    return [
      { id: 'cost-1', service: 'data-pipeline', anomaly: '存储费用突增 300%', severity: 'warning' },
    ];
  }
}
*/

// ==================== RealDataProvider (Phase 1a) ====================

/**
 * 真实数据提供者 — 从数据库表查询数据
 * 表不存在时优雅降级为空数组
 */
export class RealDataProvider implements DataProvider {
  private pool: DatabasePool;
  private tenantId?: string;

  constructor(pool: DatabasePool, tenantId?: string) {
    this.pool = pool;
    this.tenantId = tenantId;
  }

  /** 安全执行查询，所有错误均优雅降级为空数组 */
  private async safeQuery(sql: string, params: unknown[] = []): Promise<any[]> {
    try {
      const result = await this.pool.query(sql, params as any[]);
      return result.rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('does not exist')) {
        logger.warn(`[RealDataProvider] Table not found, returning empty: ${msg}`);
      } else {
        logger.warn(`[RealDataProvider] Query failed, returning empty: ${msg}`);
      }
      return [];
    }
  }

  async getActiveAlerts(): Promise<MockAlert[]> {
    let sql = `SELECT id, severity, title, message FROM alerts WHERE status = 'firing'`;
    const params: unknown[] = [];
    if (this.tenantId) {
      sql += ' AND tenant_id = $1';
      params.push(this.tenantId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 20';

    const rows = await this.safeQuery(sql, params);
    return rows.map((row) => ({
      id: String(row.id),
      severity: (row.severity as 'critical' | 'warning' | 'info') || 'warning',
      title: row.title || '未知告警',
      message: row.message || '',
      resource: row.title || String(row.id),
    }));
  }

  async getBlockedPipelines(): Promise<MockBlockedPipeline[]> {
    let sql = `SELECT id, pipeline_id, status, error_message FROM pipeline_runs WHERE status IN ('pending', 'running')`;
    const params: unknown[] = [];
    if (this.tenantId) {
      sql += ' AND tenant_id = $1';
      params.push(this.tenantId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 20';

    const rows = await this.safeQuery(sql, params);
    return rows.map((row) => ({
      pipelineId: String(row.id),
      message: row.error_message || '等待执行',
      status: 'blocked' as const,
    }));
  }

  async getFailedSelfHealingExecutions(): Promise<MockFailedSelfHealing[]> {
    let sql = `SELECT id, strategy_id, strategy_name, error, app_name FROM self_healing_incidents WHERE status IN ('failed', 'error')`;
    const params: unknown[] = [];
    // self_healing_incidents 表无 tenant_id，按 app_name 过滤
    if (this.tenantId) {
      // 租户关联应用名，这里简化处理，不额外过滤
    }
    sql += ' ORDER BY started_at DESC LIMIT 20';

    const rows = await this.safeQuery(sql, params);
    return rows.map((row) => ({
      policyId: String(row.id),
      policyName: row.strategy_name || '未知策略',
      error: row.error || '未知错误',
      service: row.app_name || 'unknown',
    }));
  }

  async getCostAnomalies(): Promise<MockCostAnomaly[]> {
    let sql = `SELECT id, name as service, severity, condition, threshold FROM alert_rules WHERE status = 'active' AND severity IN ('warning', 'critical')`;
    const params: unknown[] = [];
    // alert_rules 表无 tenant_id，简化处理
    sql += ' ORDER BY created_at DESC LIMIT 20';

    const rows = await this.safeQuery(sql, params);
    return rows.map((row) => ({
      id: String(row.id),
      service: row.service || 'unknown',
      anomaly: `规则: ${row.condition || 'unknown'} > ${row.threshold ?? 'N/A'}`,
      severity: (row.severity as 'critical' | 'warning' | 'info') || 'warning',
    }));
  }
}

// ==================== Recommendation Service ====================

export class RecommendationService {
  private dataProvider: DataProvider;
  // 内存缓存 30 秒
  private cache: Map<string, { data: ChatOpsRecommendation[]; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30_000;

  constructor(dataProvider: DataProvider) {
    this.dataProvider = dataProvider;
  }

  async getRecommendations(userId: string, userRole: string): Promise<ChatOpsRecommendation[]> {
    // RealDataProvider 查询全局数据（待 Phase 1b 租户隔离完善后改为 ${tenantId}:${userRole}）
    const cacheKey = `global:${userRole}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const results: ChatOpsRecommendation[] = [];

    try {
      // 1. 活跃告警
      const alerts = await this.dataProvider.getActiveAlerts();
      results.push(...alerts.map((a: MockAlert) => this.alertToRecommendation(a)));

      // 2. 阻塞任务
      const blocked = await this.dataProvider.getBlockedPipelines();
      results.push(...blocked.map((p: MockBlockedPipeline) => this.pipelineToRecommendation(p)));

      // 3. 自愈失败
      const failed = await this.dataProvider.getFailedSelfHealingExecutions();
      results.push(...failed.map((f: MockFailedSelfHealing) => this.selfhealingToRecommendation(f)));

      // 4. 成本异常
      const anomalies = await this.dataProvider.getCostAnomalies();
      results.push(...anomalies.map((a: MockCostAnomaly) => this.finopsToRecommendation(a)));
    } catch (err) {
      logger.error('[RecommendationService] Failed to fetch recommendations:', err);
    }

    this.cache.set(cacheKey, { data: results, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return results;
  }

  /** 清除缓存 (角色变更时调用，当前使用全局缓存键) */
  invalidateCache(_userId: string): void {
    // 当前缓存键为 global:${userRole}，不再按用户区分
    // Phase 1b 租户隔离后改为按租户+角色失效
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith('global:')) keysToDelete.push(key);
    }
    keysToDelete.forEach(k => this.cache.delete(k));
  }

  // ==================== 转换方法 ====================

  private alertToRecommendation(alert: MockAlert): ChatOpsRecommendation {
    return {
      id: `alert:${alert.id}`,
      type: 'alert',
      severity: alert.severity,
      title: alert.title,
      description: alert.message,
      actions: [
        { label: '查看日志', command: 'logs', params: { resource: alert.resource } },
        { label: '诊断根因', command: 'diagnose', params: { resource: alert.resource } },
      ],
      createdAt: new Date(),
      source: 'monitoring',
    };
  }

  private pipelineToRecommendation(pipeline: MockBlockedPipeline): ChatOpsRecommendation {
    return {
      id: `pipeline:${pipeline.pipelineId}`,
      type: 'blocked',
      severity: 'warning',
      title: `Pipeline #${pipeline.pipelineId} 等待确认`,
      description: pipeline.message,
      actions: [
        { label: '批准', command: 'pipeline', params: { action: 'approve', id: pipeline.pipelineId } },
        { label: '拒绝', command: 'pipeline', params: { action: 'reject', id: pipeline.pipelineId } },
      ],
      createdAt: new Date(),
      source: 'pipeline',
    };
  }

  private selfhealingToRecommendation(failed: MockFailedSelfHealing): ChatOpsRecommendation {
    return {
      id: `selfhealing:${failed.policyId}`,
      type: 'selfhealing',
      severity: 'warning',
      title: `自愈失败: ${failed.policyName}`,
      description: failed.error,
      actions: [
        { label: '手动干预', command: 'diagnose', params: { resource: failed.service } },
      ],
      createdAt: new Date(),
      source: 'selfhealing',
    };
  }

  private finopsToRecommendation(anomaly: MockCostAnomaly): ChatOpsRecommendation {
    return {
      id: `cost:${anomaly.id}`,
      type: 'cost_anomaly',
      severity: anomaly.severity,
      title: `成本异常: ${anomaly.service}`,
      description: anomaly.anomaly,
      actions: [
        { label: '查看详情', command: 'status', params: { resource: anomaly.service } },
      ],
      createdAt: new Date(),
      source: 'finops',
    };
  }
}
