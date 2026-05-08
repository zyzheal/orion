/**
 * Plugin Audit Log Repository Interface
 * 插件审计日志数据访问层
 */

import { PluginAuditLog, CreatePluginAuditLog } from '../models/PluginAuditLog';

export interface PluginAuditLogRepository {
  create(log: CreatePluginAuditLog): Promise<PluginAuditLog>;
  findById(id: string): Promise<PluginAuditLog | undefined>;
  findByTaskId(taskId: string): Promise<PluginAuditLog[]>;
  findByPluginId(pluginId: string): Promise<PluginAuditLog[]>;
  findByTenantId(tenantId: string, limit?: number): Promise<PluginAuditLog[]>;
}

export class PostgresPluginAuditLogRepository implements PluginAuditLogRepository {
  constructor(private db: any) {}

  async create(log: CreatePluginAuditLog): Promise<PluginAuditLog> {
    const query = `
      INSERT INTO plugin_audit_logs (
        id, task_id, plugin_id, user_id, tenant_id, action, outcome,
        duration_ms, isolation_tier, approval_id, code_hash,
        permissions, result_data, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      RETURNING *
    `;

    const id = this.generateId();
    const result = await this.db.query(query, [
      id,
      log.taskId,
      log.pluginId,
      log.userId,
      log.tenantId,
      log.action,
      log.outcome,
      log.durationMs ?? null,
      log.isolationTier ?? null,
      log.approvalId ?? null,
      log.codeHash ?? null,
      log.permissions ? JSON.stringify(log.permissions) : null,
      log.resultData ? JSON.stringify(log.resultData) : null,
      log.errorMessage ?? null,
    ]);

    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<PluginAuditLog | undefined> {
    const query = `
      SELECT * FROM plugin_audit_logs WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return undefined;
    }

    return this.mapRow(result.rows[0]);
  }

  async findByTaskId(taskId: string): Promise<PluginAuditLog[]> {
    const query = `
      SELECT * FROM plugin_audit_logs WHERE task_id = $1 ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [taskId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByPluginId(pluginId: string): Promise<PluginAuditLog[]> {
    const query = `
      SELECT * FROM plugin_audit_logs WHERE plugin_id = $1 ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [pluginId]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<PluginAuditLog[]> {
    const query = `
      SELECT * FROM plugin_audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2
    `;

    const result = await this.db.query(query, [tenantId, limit]);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  private mapRow(row: any): PluginAuditLog {
    return {
      id: row.id,
      taskId: row.task_id,
      pluginId: row.plugin_id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      action: row.action,
      outcome: row.outcome,
      durationMs: row.duration_ms,
      isolationTier: row.isolation_tier,
      approvalId: row.approval_id,
      codeHash: row.code_hash,
      permissions: row.permissions,
      resultData: row.result_data,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
