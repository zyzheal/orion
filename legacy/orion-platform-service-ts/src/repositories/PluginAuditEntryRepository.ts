/**
 * PluginAuditEntryRepository
 * Plugin audit entry data access layer (audit log entries from PluginAuditLogger)
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginAuditEntryEntity {
  id: string;
  tenantId: string | null;
  pluginId: string | null;
  taskId: string | null;
  level: string;
  action: string;
  message: string | null;
  input: any;
  output: any;
  durationMs: number | null;
  metadata: Record<string, any>;
  entryAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class PluginAuditEntryRepository extends BaseRepository<PluginAuditEntryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_audit_entries');
  }

  async findByTaskId(taskId: string, limit: number = 100): Promise<PluginAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_audit_entries WHERE task_id = $1 ORDER BY entry_at DESC LIMIT $2`,
      [taskId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByPluginId(pluginId: string, limit: number = 100): Promise<PluginAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_audit_entries WHERE plugin_id = $1 ORDER BY entry_at DESC LIMIT $2`,
      [pluginId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByLevel(level: string, limit: number = 100): Promise<PluginAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_audit_entries WHERE level = $1 ORDER BY entry_at DESC LIMIT $2`,
      [level, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByAction(action: string, limit: number = 100): Promise<PluginAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_audit_entries WHERE action = $1 ORDER BY entry_at DESC LIMIT $2`,
      [action, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<PluginAuditEntryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_audit_entries WHERE tenant_id = $1 ORDER BY entry_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFilters(filters: {
    taskId?: string;
    pluginId?: string;
    level?: string;
    action?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<PluginAuditEntryEntity[]> {
    let query = 'SELECT * FROM plugin_audit_entries WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.taskId) {
      query += ` AND task_id = $${paramIndex}`;
      params.push(filters.taskId);
      paramIndex++;
    }
    if (filters.pluginId) {
      query += ` AND plugin_id = $${paramIndex}`;
      params.push(filters.pluginId);
      paramIndex++;
    }
    if (filters.level) {
      query += ` AND level = $${paramIndex}`;
      params.push(filters.level);
      paramIndex++;
    }
    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }
    if (filters.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(filters.tenantId);
      paramIndex++;
    }

    query += ' ORDER BY entry_at DESC';
    const limit = filters.limit || 100;
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async cleanupExpired(retentionMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const result = await this.db.query(
      `DELETE FROM plugin_audit_entries WHERE entry_at < $1`,
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  async countByFilters(filters: {
    taskId?: string;
    pluginId?: string;
    level?: string;
    action?: string;
    tenantId?: string;
  }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM plugin_audit_entries WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.taskId) {
      query += ` AND task_id = $${paramIndex}`;
      params.push(filters.taskId);
      paramIndex++;
    }
    if (filters.pluginId) {
      query += ` AND plugin_id = $${paramIndex}`;
      params.push(filters.pluginId);
      paramIndex++;
    }
    if (filters.level) {
      query += ` AND level = $${paramIndex}`;
      params.push(filters.level);
      paramIndex++;
    }
    if (filters.action) {
      query += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }
    if (filters.tenantId) {
      query += ` AND tenant_id = $${paramIndex}`;
      params.push(filters.tenantId);
      paramIndex++;
    }

    const result = await this.db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  protected mapRowToEntity(row: any): PluginAuditEntryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pluginId: row.plugin_id,
      taskId: row.task_id,
      level: row.level,
      action: row.action,
      message: row.message,
      input: row.input,
      output: row.output,
      durationMs: row.duration_ms,
      metadata: row.metadata ?? {},
      entryAt: row.entry_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
