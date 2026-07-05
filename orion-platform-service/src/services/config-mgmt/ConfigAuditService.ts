/**
 * ConfigAuditService - Configuration audit trail with PostgreSQL persistence
 *
 * Records all configuration operations for compliance and traceability.
 * Supports querying, filtering, and exporting audit logs.
 *
 * Migration: in-memory Map/Array -> PostgreSQL (migration 377)
 * Fallback: DB failure automatically falls back to in-memory storage.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';

// ============================================================
// Types (public interface - unchanged)
// ============================================================

export type AuditAction =
  | 'config.create'
  | 'config.update'
  | 'config.delete'
  | 'config.rollback'
  | 'flag.create'
  | 'flag.update'
  | 'flag.toggle'
  | 'flag.delete'
  | 'experiment.create'
  | 'experiment.start'
  | 'experiment.stop'
  | 'experiment.cancel'
  | 'drift.remediate';

export interface ConfigAuditEntry {
  id: string;
  tenantId: string;
  action: AuditAction;
  resourceType: 'config' | 'flag' | 'experiment' | 'drift';
  resourceId: string;
  resourceKey?: string;
  actor: string;
  actorRole?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditFilter {
  tenantId: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  resourceId?: string;
  actor?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================
// Repository (internal, with memory fallback)
// ============================================================

class ConfigAuditRepository {
  private pool: DatabasePool | null;
  private memory: ConfigAuditEntry[] = [];

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  /** Insert one audit entry. Falls back to memory on DB failure. */
  async save(entry: ConfigAuditEntry): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.unshift(entry);
      return;
    }

    try {
      await this.pool!.query(
        `INSERT INTO config_audit_logs (
          id, tenant_id, action, resource_type, resource_id, resource_key,
          actor, actor_role, old_value, new_value, reason,
          ip_address, user_agent, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          entry.id,
          entry.tenantId,
          entry.action,
          entry.resourceType,
          entry.resourceId,
          entry.resourceKey ?? null,
          entry.actor,
          entry.actorRole ?? null,
          entry.oldValue ? JSON.stringify(entry.oldValue) : null,
          entry.newValue ? JSON.stringify(entry.newValue) : null,
          entry.reason ?? null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.createdAt.toISOString(),
        ],
      );
    } catch {
      // DB failure: degrade to memory
      this.memory.unshift(entry);
    }
  }

  /** Query audit entries with filters. Falls back to memory on DB failure. */
  async query(filter: AuditFilter): Promise<ConfigAuditEntry[]> {
    if (!this.isDbAvailable()) {
      return this.queryMemory(filter);
    }

    try {
      return await this.queryDb(filter);
    } catch {
      // DB failure: degrade to memory
      return this.queryMemory(filter);
    }
  }

  /** Count entries (optional resourceType filter). Falls back to memory on DB failure. */
  async count(filter: { tenantId: string; resourceType?: string }): Promise<number> {
    if (!this.isDbAvailable()) {
      let results = this.memory.filter(e => e.tenantId === filter.tenantId);
      if (filter.resourceType) {
        results = results.filter(e => e.resourceType === filter.resourceType);
      }
      return results.length;
    }

    try {
      return await this.countDb(filter);
    } catch {
      let results = this.memory.filter(e => e.tenantId === filter.tenantId);
      if (filter.resourceType) {
        results = results.filter(e => e.resourceType === filter.resourceType);
      }
      return results.length;
    }
  }

  // --- Database path ---

  private async queryDb(filter: AuditFilter): Promise<ConfigAuditEntry[]> {
    let sql = 'SELECT * FROM config_audit_logs WHERE tenant_id = $1';
    const params: unknown[] = [filter.tenantId];
    let idx = 2;

    if (filter.action) {
      const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
      sql += ` AND action = ANY($${idx})`;
      params.push(actions);
      idx++;
    }
    if (filter.resourceType) {
      sql += ` AND resource_type = $${idx}`;
      params.push(filter.resourceType);
      idx++;
    }
    if (filter.resourceId) {
      sql += ` AND resource_id = $${idx}`;
      params.push(filter.resourceId);
      idx++;
    }
    if (filter.actor) {
      sql += ` AND actor = $${idx}`;
      params.push(filter.actor);
      idx++;
    }
    if (filter.startDate) {
      sql += ` AND created_at >= $${idx}`;
      params.push(filter.startDate.toISOString());
      idx++;
    }
    if (filter.endDate) {
      sql += ` AND created_at <= $${idx}`;
      params.push(filter.endDate.toISOString());
      idx++;
    }

    sql += ' ORDER BY created_at DESC';
    if (filter.limit) {
      sql += ` LIMIT $${idx}`;
      params.push(filter.limit);
      idx++;
    }
    if (filter.offset) {
      sql += ` OFFSET $${idx}`;
      params.push(filter.offset);
    }

    const rows = (await this.pool!.query(sql, params)).rows;
    return rows.map((row: any) => this.rowToEntry(row));
  }

  private async countDb(filter: { tenantId: string; resourceType?: string }): Promise<number> {
    let sql = 'SELECT COUNT(*) AS total FROM config_audit_logs WHERE tenant_id = $1';
    const params: unknown[] = [filter.tenantId];
    let idx = 2;

    if (filter.resourceType) {
      sql += ` AND resource_type = $${idx}`;
      params.push(filter.resourceType);
      idx++;
    }

    const result = await this.pool!.query(sql, params);
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  private rowToEntry(row: any): ConfigAuditEntry {
    const parseJson = (val: unknown): Record<string, unknown> | undefined => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'object') return val as Record<string, unknown>;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return undefined; }
      }
      return undefined;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      action: row.action as AuditAction,
      resourceType: row.resource_type as ConfigAuditEntry['resourceType'],
      resourceId: row.resource_id,
      resourceKey: row.resource_key ?? undefined,
      actor: row.actor,
      actorRole: row.actor_role ?? undefined,
      oldValue: parseJson(row.old_value),
      newValue: parseJson(row.new_value),
      reason: row.reason ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      metadata: parseJson(row.metadata),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  // --- Memory path ---

  private queryMemory(filter: AuditFilter): ConfigAuditEntry[] {
    let results = this.memory.filter(e => e.tenantId === filter.tenantId);

    if (filter.action) {
      const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
      results = results.filter(e => actions.includes(e.action));
    }
    if (filter.resourceType) {
      results = results.filter(e => e.resourceType === filter.resourceType);
    }
    if (filter.resourceId) {
      results = results.filter(e => e.resourceId === filter.resourceId);
    }
    if (filter.actor) {
      results = results.filter(e => e.actor === filter.actor);
    }
    if (filter.startDate) {
      results = results.filter(e => e.createdAt >= filter.startDate!);
    }
    if (filter.endDate) {
      results = results.filter(e => e.createdAt <= filter.endDate!);
    }

    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return results.slice(offset, offset + limit);
  }
}

// ============================================================
// Service (public interface - unchanged)
// ============================================================

export class ConfigAuditService {
  private repository: ConfigAuditRepository;

  constructor(database?: DatabasePool) {
    this.repository = new ConfigAuditRepository(database);
  }

  async record(
    tenantId: string,
    action: AuditAction,
    resourceType: ConfigAuditEntry['resourceType'],
    resourceId: string,
    actor: string,
    options?: {
      resourceKey?: string;
      actorRole?: string;
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ConfigAuditEntry> {
    const entry: ConfigAuditEntry = {
      id: uuidv4(),
      tenantId,
      action,
      resourceType,
      resourceId,
      resourceKey: options?.resourceKey,
      actor,
      actorRole: options?.actorRole,
      oldValue: options?.oldValue,
      newValue: options?.newValue,
      reason: options?.reason,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: options?.metadata,
      createdAt: new Date(),
    };

    await this.repository.save(entry);
    return entry;
  }

  async queryAuditLog(filter: AuditFilter): Promise<ConfigAuditEntry[]> {
    return this.repository.query(filter);
  }

  async getEntryCount(tenantId: string, resourceType?: string): Promise<number> {
    return this.repository.count({ tenantId, resourceType });
  }
}
