/**
 * ConfigAuditService - Configuration audit trail
 *
 * Records all configuration operations for compliance and traceability.
 * Supports querying, filtering, and exporting audit logs.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';

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
// Repository
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

  async save(entry: ConfigAuditEntry): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.unshift(entry);
      return;
    }
    await this.pool!.query(
      `INSERT INTO config_audit_log (
        id, tenant_id, action, resource_type, resource_id, resource_key,
        actor, actor_role, old_value, new_value, reason,
        ip_address, user_agent, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        entry.id, entry.tenantId, entry.action, entry.resourceType,
        entry.resourceId, entry.resourceKey || null,
        entry.actor, entry.actorRole || null,
        entry.oldValue ? JSON.stringify(entry.oldValue) : null,
        entry.newValue ? JSON.stringify(entry.newValue) : null,
        entry.reason || null,
        entry.ipAddress || null, entry.userAgent || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.createdAt,
      ]
    );
  }

  async query(filter: AuditFilter): Promise<ConfigAuditEntry[]> {
    if (!this.isDbAvailable()) {
      let results = this.memory.filter(e => e.tenantId === filter.tenantId);
      if (filter.action) {
        const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
        results = results.filter(e => actions.includes(e.action));
      }
      if (filter.resourceType) results = results.filter(e => e.resourceType === filter.resourceType);
      if (filter.resourceId) results = results.filter(e => e.resourceId === filter.resourceId);
      if (filter.actor) results = results.filter(e => e.actor === filter.actor);
      if (filter.startDate) results = results.filter(e => e.createdAt >= filter.startDate!);
      if (filter.endDate) results = results.filter(e => e.createdAt <= filter.endDate!);
      const offset = filter.offset || 0;
      const limit = filter.limit || 100;
      return results.slice(offset, offset + limit);
    }

    let query = 'SELECT * FROM config_audit_log WHERE tenant_id = $1';
    const params: unknown[] = [filter.tenantId];
    let paramIdx = 2;

    if (filter.action) {
      const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
      query += ` AND action = ANY($${paramIdx})`;
      params.push(actions);
      paramIdx++;
    }
    if (filter.resourceType) {
      query += ` AND resource_type = $${paramIdx}`;
      params.push(filter.resourceType);
      paramIdx++;
    }
    if (filter.resourceId) {
      query += ` AND resource_id = $${paramIdx}`;
      params.push(filter.resourceId);
      paramIdx++;
    }
    if (filter.actor) {
      query += ` AND actor = $${paramIdx}`;
      params.push(filter.actor);
      paramIdx++;
    }
    if (filter.startDate) {
      query += ` AND created_at >= $${paramIdx}`;
      params.push(filter.startDate);
      paramIdx++;
    }
    if (filter.endDate) {
      query += ` AND created_at <= $${paramIdx}`;
      params.push(filter.endDate);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    if (filter.limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(filter.limit);
      paramIdx++;
    }
    if (filter.offset) {
      query += ` OFFSET $${paramIdx}`;
      params.push(filter.offset);
    }

    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: any) => this.rowToEntry(r));
  }

  private rowToEntry(row: any): ConfigAuditEntry {
    return {
      id: row.id, tenantId: row.tenant_id, action: row.action as AuditAction,
      resourceType: row.resource_type as ConfigAuditEntry['resourceType'],
      resourceId: row.resource_id, resourceKey: row.resource_key || undefined,
      actor: row.actor, actorRole: row.actor_role || undefined,
      oldValue: row.old_value || undefined, newValue: row.new_value || undefined,
      reason: row.reason || undefined, ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined, metadata: row.metadata || undefined,
      createdAt: row.created_at,
    };
  }
}

// ============================================================
// Service
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
    }
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
    const entries = await this.repository.query({
      tenantId,
      resourceType,
      limit: 10000,
    });
    return entries.length;
  }
}
