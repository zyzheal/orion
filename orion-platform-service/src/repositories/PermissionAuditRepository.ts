/**
 * PermissionAuditRepository - 权限审计日志数据访问层
 *
 * 记录所有权限评估决策（allow/deny），用于安全审计和 UEBA 分析。
 */

import { DatabasePool } from '../services/database';

export interface AuditLogEntry {
  userId: string;
  tenantId?: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  decision: 'allow' | 'deny';
  decisionSource: 'rbac' | 'abac' | 'relationship' | 'super_admin_bypass' | 'all' | 'capability';
  reason: string;
}

export class PermissionAuditRepository {
  constructor(private pool: DatabasePool) {}

  /** 记录一次权限评估决策 */
  async logDecision(entry: AuditLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO permission_audit_logs
       (user_id, tenant_id, resource_type, resource_id, action, decision, decision_source, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId,
        entry.tenantId || null,
        entry.resourceType,
        entry.resourceId || null,
        entry.action,
        entry.decision,
        entry.decisionSource,
        entry.reason,
      ]
    );
  }

  /** 批量记录权限评估决策 */
  async logDecisions(entries: AuditLogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const values = entries.map((_, i) => {
      const base = i * 8 + 1;
      return `($${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(', ');

    const params: unknown[] = [];
    for (const e of entries) {
      params.push(e.userId, e.tenantId || null, e.resourceType, e.resourceId || null, e.action, e.decision, e.decisionSource, e.reason);
    }

    await this.pool.query(
      `INSERT INTO permission_audit_logs
       (user_id, tenant_id, resource_type, resource_id, action, decision, decision_source, reason)
       VALUES ${values}`,
      params
    );
  }

  /** 查询用户的审计日志（按时间倒序） */
  async queryByUser(userId: string, limit = 100, tenantId?: string): Promise<any[]> {
    if (tenantId) {
      const result = await this.pool.query(
        `SELECT * FROM permission_audit_logs
         WHERE user_id = $1 AND tenant_id = $2
         ORDER BY evaluated_at DESC
         LIMIT $3`,
        [userId, tenantId, limit]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      `SELECT * FROM permission_audit_logs
       WHERE user_id = $1
       ORDER BY evaluated_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /** 查询所有拒绝记录 */
  async queryDenied(limit = 100, tenantId?: string): Promise<any[]> {
    if (tenantId) {
      const result = await this.pool.query(
        `SELECT * FROM permission_audit_logs
         WHERE decision = 'deny' AND tenant_id = $1
         ORDER BY evaluated_at DESC
         LIMIT $2`,
        [tenantId, limit]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      `SELECT * FROM permission_audit_logs
       WHERE decision = 'deny'
       ORDER BY evaluated_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /** 按资源类型查询审计日志 */
  async queryByResource(resourceType: string, resourceId?: string, limit = 100, tenantId?: string): Promise<any[]> {
    if (resourceId) {
      if (tenantId) {
        const result = await this.pool.query(
          `SELECT * FROM permission_audit_logs
           WHERE resource_type = $1 AND resource_id = $2 AND tenant_id = $3
           ORDER BY evaluated_at DESC
           LIMIT $4`,
          [resourceType, resourceId, tenantId, limit]
        );
        return result.rows;
      }
      const result = await this.pool.query(
        `SELECT * FROM permission_audit_logs
         WHERE resource_type = $1 AND resource_id = $2
         ORDER BY evaluated_at DESC
         LIMIT $3`,
        [resourceType, resourceId, limit]
      );
      return result.rows;
    }
    if (tenantId) {
      const result = await this.pool.query(
        `SELECT * FROM permission_audit_logs
         WHERE resource_type = $1 AND tenant_id = $2
         ORDER BY evaluated_at DESC
         LIMIT $3`,
        [resourceType, tenantId, limit]
      );
      return result.rows;
    }
    const result = await this.pool.query(
      `SELECT * FROM permission_audit_logs
       WHERE resource_type = $1
       ORDER BY evaluated_at DESC
       LIMIT $2`,
      [resourceType, limit]
    );
    return result.rows;
  }

  /** 统计拒绝次数（按用户） */
  async countDeniedByUser(hours = 24, tenantId?: string): Promise<{ user_id: string; count: string }[]> {
    const params: unknown[] = [hours];
    let idx = 2;
    const tenantCondition = tenantId ? `AND tenant_id = $${idx++}` : '';

    if (tenantId) {
      params.push(tenantId);
    }

    const result = await this.pool.query(
      `SELECT user_id, COUNT(*) as count
       FROM permission_audit_logs
       WHERE decision = 'deny'
         ${tenantCondition}
         AND evaluated_at > NOW() - ($1 * INTERVAL '1 hour')
       GROUP BY user_id
       ORDER BY count DESC`,
      params
    );
    return result.rows;
  }
}
