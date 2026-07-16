/**
 * PluginAuditLogRepository
 *
 * Data access layer for the plugin_audit_logs table.
 * Wraps DB operations with in-memory fallback degradation.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('PluginAuditLogPgRepository');

export interface PluginAuditLogEntity {
  id: string;
  tenantId: string;
  pluginId: string;
  action: string;
  userId: string | null;
  details: Record<string, any>;
  severity: string;
  createdAt: Date;
}

export interface CreatePluginAuditLogParams {
  tenantId: string;
  pluginId: string;
  action: string;
  userId?: string | null;
  details?: Record<string, any>;
  severity?: string;
}

interface DatabasePool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

/** In-memory degradation store */
class InMemoryFallback {
  private logs: PluginAuditLogEntity[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  create(entity: PluginAuditLogEntity): void {
    this.logs.push(entity);
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(this.logs.length - this.maxEntries);
    }
  }

  findByFilters(filters: {
    pluginId?: string;
    severity?: string;
    limit?: number;
  }): PluginAuditLogEntity[] {
    let entries = [...this.logs];

    if (filters.pluginId) {
      entries = entries.filter(e => e.pluginId === filters.pluginId);
    }
    if (filters.severity) {
      entries = entries.filter(e => e.severity === filters.severity);
    }

    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  countByTenant(tenantId: string): number {
    return this.logs.filter(e => e.tenantId === tenantId).length;
  }

  cleanupExpired(retentionMs: number): number {
    const cutoff = Date.now() - retentionMs;
    const before = this.logs.length;
    this.logs = this.logs.filter(e => e.createdAt.getTime() >= cutoff);
    return before - this.logs.length;
  }
}

export class PluginAuditLogRepository {
  private db: DatabasePool | null;
  private memoryFallback: InMemoryFallback;
  private dbAvailable = false;

  constructor(
    db: DatabasePool | null,
    maxEntries: number = 10000,
  ) {
    this.db = db;
    this.memoryFallback = new InMemoryFallback(maxEntries);
    this.dbAvailable = !!db;
  }

  /**
   * Check if DB connection is still healthy.
   * Called periodically to re-establish dbAvailable flag.
   */
  async healthCheck(): Promise<void> {
    if (!this.db) {
      this.dbAvailable = false;
      return;
    }
    try {
      await this.db.query('SELECT 1');
      this.dbAvailable = true;
    } catch {
      this.dbAvailable = false;
      logger.warn('plugin_audit_logs: DB health check failed, using in-memory fallback');
    }
  }

  /**
   * Create an audit log entry.
   * Falls back to in-memory storage if DB is unavailable.
   */
  async create(params: CreatePluginAuditLogParams): Promise<PluginAuditLogEntity> {
    const entity: PluginAuditLogEntity = {
      id: crypto.randomUUID(),
      tenantId: params.tenantId,
      pluginId: params.pluginId,
      action: params.action,
      userId: params.userId ?? null,
      details: params.details ?? {},
      severity: params.severity ?? 'info',
      createdAt: new Date(),
    };

    if (this.dbAvailable) {
      try {
        await this.db!.query(
          `INSERT INTO plugin_audit_logs (id, tenant_id, plugin_id, action, user_id, details, severity, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [entity.id, entity.tenantId, entity.pluginId, entity.action, entity.userId,
           JSON.stringify(entity.details), entity.severity, entity.createdAt],
        );
        return entity;
      } catch (err) {
        logger.warn(
          { error: err, pluginId: params.pluginId, action: params.action },
          'plugin_audit_logs: DB insert failed, falling back to in-memory',
        );
        this.dbAvailable = false;
      }
    }

    this.memoryFallback.create(entity);
    return entity;
  }

  /**
   * Batch create audit log entries (for performance).
   */
  async createBatch(paramsList: CreatePluginAuditLogParams[]): Promise<PluginAuditLogEntity[]> {
    if (paramsList.length === 0) return [];

    const entities: PluginAuditLogEntity[] = paramsList.map(p => ({
      id: crypto.randomUUID(),
      tenantId: p.tenantId,
      pluginId: p.pluginId,
      action: p.action,
      userId: p.userId ?? null,
      details: p.details ?? {},
      severity: p.severity ?? 'info',
      createdAt: new Date(),
    }));

    if (this.dbAvailable) {
      try {
        const values = entities.map(e =>
          `(${this.q(v => this.toSqlParam(v, 'id'))}, ${this.q(v => this.toSqlParam(v, 'tenantId'))}, ${this.q(v => this.toSqlParam(v, 'pluginId'))}, ${this.q(v => this.toSqlParam(v, 'action'))}, ${this.q(v => this.toSqlParam(v, 'userId'))}, '${JSON.stringify(e.details)}'::jsonb, ${this.q(v => this.toSqlParam(v, 'severity'))}, ${this.q(v => this.toSqlParam(v, 'createdAt'))})`,
        ).join(', ');

        await this.db!.query(
          `INSERT INTO plugin_audit_logs (id, tenant_id, plugin_id, action, user_id, details, severity, created_at) VALUES ${values}`,
        );
        return entities;
      } catch (err) {
        logger.warn(
          { error: err, count: paramsList.length },
          'plugin_audit_logs: batch DB insert failed, falling back to in-memory',
        );
        this.dbAvailable = false;
      }
    }

    for (const entity of entities) {
      this.memoryFallback.create(entity);
    }
    return entities;
  }

  /**
   * Find entries by filters.
   * Queries DB first, falls back to in-memory.
   */
  async findByFilters(filters: {
    pluginId?: string;
    severity?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<PluginAuditLogEntity[]> {
    if (this.dbAvailable) {
      try {
        let query = 'SELECT * FROM plugin_audit_logs WHERE 1=1';
        const params: unknown[] = [];
        let paramIdx = 1;

        if (filters.pluginId) {
          query += ` AND plugin_id = $${paramIdx}`;
          params.push(filters.pluginId);
          paramIdx++;
        }
        if (filters.severity) {
          query += ` AND severity = $${paramIdx}`;
          params.push(filters.severity);
          paramIdx++;
        }
        if (filters.tenantId) {
          query += ` AND tenant_id = $${paramIdx}`;
          params.push(filters.tenantId);
          paramIdx++;
        }

        query += ` ORDER BY created_at DESC`;
        if (filters.limit) {
          query += ` LIMIT $${paramIdx}`;
          params.push(filters.limit);
        }

        const result = await this.db!.query(query, params);
        return result.rows.map(this.mapRowToEntity);
      } catch (err) {
        logger.warn(
          { error: err },
          'plugin_audit_logs: DB query failed, falling back to in-memory',
        );
        this.dbAvailable = false;
      }
    }

    return this.memoryFallback.findByFilters({
      pluginId: filters.pluginId,
      severity: filters.severity,
      limit: filters.limit,
    });
  }

  /**
   * Cleanup expired entries older than retentionMs.
   */
  async cleanupExpired(retentionMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    let removedCount = 0;

    if (this.dbAvailable) {
      try {
        const result = await this.db!.query(
          'DELETE FROM plugin_audit_logs WHERE created_at < $1',
          [cutoff],
        );
        removedCount = result.rowCount ?? 0;
      } catch (err) {
        logger.warn({ error: err }, 'plugin_audit_logs: DB cleanup failed, using in-memory');
        this.dbAvailable = false;
      }
    }

    const memRemoved = this.memoryFallback.cleanupExpired(retentionMs);
    removedCount += memRemoved;
    return removedCount;
  }

  /**
   * Get count of entries by tenant.
   */
  async countByTenant(tenantId: string): Promise<number> {
    if (this.dbAvailable) {
      try {
        const result = await this.db!.query(
          'SELECT COUNT(*) as count FROM plugin_audit_logs WHERE tenant_id = $1',
          [tenantId],
        );
        return parseInt(result.rows[0].count, 10);
      } catch {
        this.dbAvailable = false;
      }
    }
    return this.memoryFallback.countByTenant(tenantId);
  }

  // ---- Private helpers ----

  private mapRowToEntity(row: any): PluginAuditLogEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pluginId: row.plugin_id,
      action: row.action,
      userId: row.user_id,
      details: row.details ?? {},
      severity: row.severity,
      createdAt: row.created_at,
    };
  }

  private q(fn: (v: any) => string): string {
    // Placeholder wrapper for batch insert
    return '';
  }

  private toSqlParam(val: unknown, _entityField: string): string {
    if (val === null || val === undefined) return 'NULL';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
    return `'${val}'`;
  }
}
