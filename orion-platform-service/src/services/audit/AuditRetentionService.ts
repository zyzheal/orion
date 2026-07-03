/**
 * AuditRetentionService - 审计日志保留策略服务
 *
 * SOC2/ISO27001 合规要求：
 * - 审计日志必须保留足够长的时间（通常至少 1 年）
 * - 支持自动清理过期日志
 * - 支持归档而非直接删除
 * - 保留策略可配置
 */

import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export interface AuditRetentionPolicy {
  id: string;
  tenantId: string;
  retentionDays: number;
  archiveBeforeDelete: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditRetentionPolicyInput {
  tenantId: string;
  retentionDays: number;
  archiveBeforeDelete?: boolean;
}

export interface RetentionCleanupResult {
  totalScanned: number;
  archivedCount: number;
  deletedCount: number;
  skippedCount: number;
  errors: string[];
}

export class AuditRetentionService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * 创建或更新租户的审计日志保留策略
   */
  async upsertPolicy(input: AuditRetentionPolicyInput): Promise<AuditRetentionPolicy> {
    const { tenantId, retentionDays, archiveBeforeDelete = true } = input;

    if (retentionDays < 30) {
      throw new OrionError('Audit retention days must be at least 30', ErrorCode.VALIDATION_ERROR);
    }

    const result = await this.pool.query(
      `INSERT INTO audit_retention_policies (tenant_id, retention_days, archive_before_delete, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, true, now(), now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         retention_days = EXCLUDED.retention_days,
         archive_before_delete = EXCLUDED.archive_before_delete,
         updated_at = now()
       RETURNING *`,
      [tenantId, retentionDays, archiveBeforeDelete]
    );

    return this.mapRowToPolicy(result.rows[0]);
  }

  /**
   * 获取租户的保留策略
   */
  async getPolicy(tenantId: string): Promise<AuditRetentionPolicy | null> {
    const result = await this.pool.query(
      'SELECT * FROM audit_retention_policies WHERE tenant_id = $1',
      [tenantId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToPolicy(result.rows[0]);
  }

  /**
   * 列出所有租户的保留策略
   */
  async listPolicies(): Promise<AuditRetentionPolicy[]> {
    const result = await this.pool.query('SELECT * FROM audit_retention_policies ORDER BY tenant_id');
    return result.rows.map(row => this.mapRowToPolicy(row));
  }

  /**
   * 删除保留策略（恢复默认）
   */
  async deletePolicy(tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM audit_retention_policies WHERE tenant_id = $1',
      [tenantId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 执行审计日志清理（归档 + 删除过期日志）
   */
  async executeCleanup(tenantId?: string): Promise<RetentionCleanupResult> {
    const policies = tenantId
      ? [await this.getPolicy(tenantId)].filter(Boolean) as AuditRetentionPolicy[]
      : await this.listPolicies().filter(p => p.enabled);

    if (policies.length === 0) {
      return { totalScanned: 0, archivedCount: 0, deletedCount: 0, skippedCount: 0, errors: ['No enabled retention policies found'] };
    }

    let totalScanned = 0;
    let archivedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const policy of policies) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // 查询过期的审计日志
        const expiredResult = await this.pool.query(
          `SELECT id, tenant_id, user_id, action, resource_type, resource_id, request_method,
                  request_path, request_body, response_code, response_body, ip_address, user_agent,
                  prev_hash, hash, created_at
           FROM audit_logs
           WHERE tenant_id = $1 AND created_at < $2
           ORDER BY created_at ASC
           LIMIT 10000`,
          [policy.tenantId, cutoffDate.toISOString()]
        );

        const expiredLogs = expiredResult.rows;
        totalScanned += expiredLogs.length;

        if (expiredLogs.length === 0) continue;

        if (policy.archiveBeforeDelete) {
          // 归档到审计日志历史表
          try {
            await this.pool.query(
              `INSERT INTO audit_logs_archive (id, tenant_id, user_id, action, resource_type, resource_id,
                                               request_method, request_path, request_body, response_code,
                                               response_body, ip_address, user_agent, prev_hash, hash, created_at)
               SELECT id, tenant_id, user_id, action, resource_type, resource_id,
                      request_method, request_path, request_body, response_code,
                      response_body, ip_address, user_agent, prev_hash, hash, created_at
               FROM audit_logs
               WHERE id = ANY($1::uuid[])`,
              [expiredLogs.map(row => row.id)]
            );
            archivedCount += expiredLogs.length;
          } catch (archiveError) {
            errors.push(`Failed to archive logs for tenant ${policy.tenantId}: ${archiveError}`);
            continue;
          }
        }

        // 删除过期日志
        const deleteResult = await this.pool.query(
          'DELETE FROM audit_logs WHERE id = ANY($1::uuid[])',
          [expiredLogs.map(row => row.id)]
        );

        deletedCount += deleteResult.rowCount ?? 0;
      } catch (error) {
        errors.push(`Failed to cleanup tenant ${policy.tenantId}: ${error}`);
      }
    }

    return { totalScanned, archivedCount, deletedCount, skippedCount, errors };
  }

  /**
   * 获取审计日志保留统计
   */
  async getRetentionStats(tenantId?: string): Promise<{
    totalPolicies: number;
    enabledPolicies: number;
    totalAuditLogs: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    logsByTenant: Array<{ tenantId: string; count: number; retentionDays: number | null }>;
  }> {
    const policies = await this.listPolicies();
    const enabledPolicies = policies.filter(p => p.enabled).length;

    let totalAuditLogs = 0;
    let oldestLogDate: Date | null = null;
    let newestLogDate: Date | null = null;
    const logsByTenant: Array<{ tenantId: string; count: number; retentionDays: number | null }> = [];

    if (tenantId) {
      const countResult = await this.pool.query(
        'SELECT COUNT(*) as count, MIN(created_at) as oldest, MAX(created_at) as newest FROM audit_logs WHERE tenant_id = $1',
        [tenantId]
      );
      totalAuditLogs = parseInt(countResult.rows[0]?.count || '0', 10);
      oldestLogDate = countResult.rows[0]?.oldest ? new Date(countResult.rows[0].oldest) : null;
      newestLogDate = countResult.rows[0]?.newest ? new Date(countResult.rows[0].newest) : null;

      const policy = policies.find(p => p.tenantId === tenantId);
      logsByTenant.push({
        tenantId,
        count: totalAuditLogs,
        retentionDays: policy?.retentionDays ?? null,
      });
    } else {
      const countResult = await this.pool.query('SELECT COUNT(*) as count FROM audit_logs');
      totalAuditLogs = parseInt(countResult.rows[0]?.count || '0', 10);

      const minResult = await this.pool.query('SELECT MIN(created_at) as oldest FROM audit_logs');
      oldestLogDate = minResult.rows[0]?.oldest ? new Date(minResult.rows[0].oldest) : null;

      const maxResult = await this.pool.query('SELECT MAX(created_at) as newest FROM audit_logs');
      newestLogDate = maxResult.rows[0]?.newest ? new Date(maxResult.rows[0].newest) : null;

      // 按租户统计
      const tenantStatsResult = await this.pool.query(
        `SELECT tenant_id, COUNT(*) as count
         FROM audit_logs
         GROUP BY tenant_id
         ORDER BY count DESC`
      );

      for (const row of tenantStatsResult.rows) {
        const policy = policies.find(p => p.tenantId === row.tenant_id);
        logsByTenant.push({
          tenantId: row.tenant_id,
          count: parseInt(row.count, 10),
          retentionDays: policy?.retentionDays ?? null,
        });
      }
    }

    return {
      totalPolicies: policies.length,
      enabledPolicies,
      totalAuditLogs,
      oldestLogDate,
      newestLogDate,
      logsByTenant,
    };
  }

  private mapRowToPolicy(row: any): AuditRetentionPolicy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      retentionDays: row.retention_days,
      archiveBeforeDelete: row.archive_before_delete,
      enabled: row.enabled,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
