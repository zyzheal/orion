/**
 * PluginSecurityEventRepository
 * Plugin security event data access layer
 */

import { BaseRepository } from '../db/base-repository';

export interface PluginSecurityEventEntity {
  id: string;
  eventType: string;
  severity: string;
  taskId: string | null;
  pluginId: string | null;
  message: string | null;
  details: Record<string, any>;
  eventAt: Date;
  createdAt: Date;
}

export class PluginSecurityEventRepository extends BaseRepository<PluginSecurityEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'plugin_security_events');
  }

  async findByPluginId(pluginId: string, limit: number = 100): Promise<PluginSecurityEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_security_events WHERE plugin_id = $1 ORDER BY event_at DESC LIMIT $2`,
      [pluginId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTaskId(taskId: string): Promise<PluginSecurityEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_security_events WHERE task_id = $1 ORDER BY event_at DESC`,
      [taskId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySeverity(severity: string, limit: number = 100): Promise<PluginSecurityEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_security_events WHERE severity = $1 ORDER BY event_at DESC LIMIT $2`,
      [severity, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByType(eventType: string, limit: number = 100): Promise<PluginSecurityEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM plugin_security_events WHERE event_type = $1 ORDER BY event_at DESC LIMIT $2`,
      [eventType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async cleanupExpired(retentionMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const result = await this.db.query(
      `DELETE FROM plugin_security_events WHERE event_at < $1`,
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): PluginSecurityEventEntity {
    return {
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      taskId: row.task_id,
      pluginId: row.plugin_id,
      message: row.message,
      details: row.details ?? {},
      eventAt: row.event_at,
      createdAt: row.created_at,
    };
  }
}
