/**
 * AiSecurityAuditRepository - Database layer for AI Security audit logs and blocked requests
 *
 * Wraps DB operations with in-memory fallback degradation following the
 * PluginAuditLogPgRepository pattern.
 */

import pino from 'pino';

const logger = pino({ name: 'ai-security-audit-repository' });

// ---------------------------------------------------------------------------
// Entity Types
// ---------------------------------------------------------------------------

export interface AiSecurityAuditLogEntity {
  id: string;
  eventType: string;
  severity: string;
  sourceIp: string | null;
  userId: string | null;
  tenantId: string;
  action: string;
  resource: string | null;
  status: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAuditLogParams {
  eventType?: string;
  severity?: string;
  sourceIp?: string | null;
  userId?: string | null;
  tenantId?: string;
  action: string;
  resource?: string | null;
  status?: string;
  details?: Record<string, unknown>;
}

export interface BlockedRequestEntity {
  id: string;
  sourceIp: string;
  userId: string | null;
  tenantId: string;
  blockedAt: Date;
  reason: string;
  requestPreview: string | null;
}

export interface CreateBlockedRequestParams {
  sourceIp: string;
  userId?: string | null;
  tenantId?: string;
  reason: string;
  requestPreview?: string | null;
}

// ---------------------------------------------------------------------------
// Query filter types
// ---------------------------------------------------------------------------

export interface AuditLogQueryFilters {
  tenantId?: string;
  userId?: string;
  action?: string;
  severity?: string;
  eventType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface BlockedRequestQueryFilters {
  tenantId?: string;
  sourceIp?: string;
  userId?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// DatabasePool interface (duck-typed for flexibility)
// ---------------------------------------------------------------------------

interface DatabasePool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}

// ---------------------------------------------------------------------------
// In-memory degradation store
// ---------------------------------------------------------------------------

class AiSecurityInMemoryStore {
  private auditLogs: AiSecurityAuditLogEntity[] = [];
  private blockedRequests: BlockedRequestEntity[] = [];
  private readonly maxAuditLogs: number;

  constructor(maxAuditLogs: number = 10000) {
    this.maxAuditLogs = maxAuditLogs;
  }

  // -- Audit logs --

  addAuditLog(entry: AiSecurityAuditLogEntity): void {
    this.auditLogs.push(entry);
    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs = this.auditLogs.slice(this.auditLogs.length - this.maxAuditLogs);
    }
  }

  findAuditLogs(filters: AuditLogQueryFilters): AiSecurityAuditLogEntity[] {
    let entries = [...this.auditLogs];

    if (filters.tenantId) {
      entries = entries.filter(e => e.tenantId === filters.tenantId);
    }
    if (filters.userId) {
      entries = entries.filter(e => e.userId === filters.userId);
    }
    if (filters.action) {
      entries = entries.filter(e => e.action === filters.action);
    }
    if (filters.severity) {
      entries = entries.filter(e => e.severity === filters.severity);
    }
    if (filters.eventType) {
      entries = entries.filter(e => e.eventType === filters.eventType);
    }
    if (filters.status) {
      entries = entries.filter(e => e.status === filters.status);
    }

    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters.offset) {
      entries = entries.slice(filters.offset);
    }
    if (filters.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  countAuditLogs(filters?: { tenantId?: string; severity?: string }): number {
    let entries = this.auditLogs;
    if (filters?.tenantId) {
      entries = entries.filter(e => e.tenantId === filters.tenantId);
    }
    if (filters?.severity) {
      entries = entries.filter(e => e.severity === filters.severity);
    }
    return entries.length;
  }

  // -- Blocked requests --

  addBlockedRequest(entry: BlockedRequestEntity): void {
    this.blockedRequests.push(entry);
  }

  findBlockedRequests(filters: BlockedRequestQueryFilters): BlockedRequestEntity[] {
    let entries = [...this.blockedRequests];

    if (filters.tenantId) {
      entries = entries.filter(e => e.tenantId === filters.tenantId);
    }
    if (filters.sourceIp) {
      entries = entries.filter(e => e.sourceIp === filters.sourceIp);
    }
    if (filters.userId) {
      entries = entries.filter(e => e.userId === filters.userId);
    }

    entries.sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime());

    if (filters.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  cleanupExpired(retentionMs: number): number {
    const cutoff = Date.now() - retentionMs;
    const before = this.blockedRequests.length;
    this.blockedRequests = this.blockedRequests.filter(e => e.blockedAt.getTime() >= cutoff);
    return before - this.blockedRequests.length;
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AiSecurityAuditRepository {
  private db: DatabasePool | null;
  private memory: AiSecurityInMemoryStore;
  private dbAvailable = true;

  constructor(
    db: DatabasePool | null,
    maxAuditLogs: number = 10000,
  ) {
    this.db = db;
    this.memory = new AiSecurityInMemoryStore(maxAuditLogs);
    this.dbAvailable = !!db;
  }

  // ---- Health ----

  async healthCheck(): Promise<void> {
    if (!this.db) {
      this.dbAvailable = false;
      return;
    }
    try {
      await this.db.query('SELECT 1');
      this.dbAvailable = true;
    } catch (err) {
      this.dbAvailable = false;
      logger.warn(
        { error: err instanceof Error ? err.message : String(err) },
        'ai_security_audit: DB health check failed, using in-memory fallback',
      );
    }
  }

  // ---- Audit Logs ----

  /**
   * Create an audit log entry. Fire-and-forget to DB; always saved to memory.
   */
  async createLog(params: CreateAuditLogParams): Promise<AiSecurityAuditLogEntity> {
    const entity: AiSecurityAuditLogEntity = {
      id: crypto.randomUUID(),
      eventType: params.eventType || 'security_event',
      severity: params.severity || 'info',
      sourceIp: params.sourceIp ?? null,
      userId: params.userId ?? null,
      tenantId: params.tenantId || 'default',
      action: params.action,
      resource: params.resource ?? null,
      status: params.status || 'recorded',
      details: params.details || {},
      createdAt: new Date(),
    };

    // Save to in-memory first
    this.memory.addAuditLog(entity);

    // Fire-and-forget DB write
    if (this.dbAvailable && this.db) {
      this.dbCreateLog(entity).catch((err: unknown) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err), action: params.action },
          'ai_security_audit: DB insert failed, using in-memory only',
        );
        this.dbAvailable = false;
      });
    }

    return entity;
  }

  private async dbCreateLog(entity: AiSecurityAuditLogEntity): Promise<void> {
    await this.db!.query(
      `INSERT INTO ai_security_audit_logs
        (id, event_type, severity, source_ip, user_id, tenant_id, action, resource, status, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entity.id,
        entity.eventType,
        entity.severity,
        entity.sourceIp,
        entity.userId,
        entity.tenantId,
        entity.action,
        entity.resource,
        entity.status,
        JSON.stringify(entity.details),
        entity.createdAt,
      ],
    );
  }

  /**
   * Find audit logs by filters. Tries DB first, falls back to in-memory.
   */
  async findLogs(filters: AuditLogQueryFilters): Promise<AiSecurityAuditLogEntity[]> {
    if (this.dbAvailable && this.db) {
      try {
        let query = 'SELECT * FROM ai_security_audit_logs WHERE 1=1';
        const params: unknown[] = [];
        let paramIdx = 1;

        if (filters.tenantId) {
          query += ` AND tenant_id = $${paramIdx}`;
          params.push(filters.tenantId);
          paramIdx++;
        }
        if (filters.userId) {
          query += ` AND user_id = $${paramIdx}`;
          params.push(filters.userId);
          paramIdx++;
        }
        if (filters.action) {
          query += ` AND action = $${paramIdx}`;
          params.push(filters.action);
          paramIdx++;
        }
        if (filters.severity) {
          query += ` AND severity = $${paramIdx}`;
          params.push(filters.severity);
          paramIdx++;
        }
        if (filters.eventType) {
          query += ` AND event_type = $${paramIdx}`;
          params.push(filters.eventType);
          paramIdx++;
        }
        if (filters.status) {
          query += ` AND status = $${paramIdx}`;
          params.push(filters.status);
          paramIdx++;
        }

        query += ' ORDER BY created_at DESC';
        if (filters.limit) {
          query += ` LIMIT $${paramIdx}`;
          params.push(filters.limit);
          paramIdx++;
        }
        if (filters.offset) {
          query += ` OFFSET $${paramIdx}`;
          params.push(filters.offset);
        }

        const result = await this.db!.query(query, params);
        return result.rows.map(this.mapRowToAuditLog);
      } catch (err) {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          'ai_security_audit: DB query failed, falling back to in-memory',
        );
        this.dbAvailable = false;
      }
    }

    return this.memory.findAuditLogs(filters);
  }

  /**
   * Count audit logs. Tries DB first, falls back to in-memory.
   */
  async countLogs(filters?: { tenantId?: string }): Promise<number> {
    if (this.dbAvailable && this.db && filters?.tenantId) {
      try {
        const result = await this.db!.query(
          'SELECT COUNT(*)::int AS count FROM ai_security_audit_logs WHERE tenant_id = $1',
          [filters.tenantId],
        );
        return parseInt(String(result.rows[0]?.count ?? 0), 10);
      } catch {
        this.dbAvailable = false;
      }
    }
    return this.memory.countAuditLogs(filters);
  }

  /**
   * Update audit log status.
   */
  async updateLogStatus(id: string, status: string): Promise<boolean> {
    if (this.dbAvailable && this.db) {
      try {
        await this.db!.query(
          'UPDATE ai_security_audit_logs SET status = $1 WHERE id = $2',
          [status, id],
        );
        return true;
      } catch {
        this.dbAvailable = false;
      }
    }
    return false;
  }

  // ---- Blocked Requests ----

  /**
   * Record a blocked request. Fire-and-forget to DB.
   */
  async addBlockedRequest(params: CreateBlockedRequestParams): Promise<BlockedRequestEntity> {
    const entity: BlockedRequestEntity = {
      id: crypto.randomUUID(),
      sourceIp: params.sourceIp,
      userId: params.userId ?? null,
      tenantId: params.tenantId || 'default',
      blockedAt: new Date(),
      reason: params.reason,
      requestPreview: params.requestPreview ?? null,
    };

    this.memory.addBlockedRequest(entity);

    if (this.dbAvailable && this.db) {
      this.dbAddBlockedRequest(entity).catch((err: unknown) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          'ai_security_audit: DB blocked_request insert failed',
        );
        this.dbAvailable = false;
      });
    }

    return entity;
  }

  private async dbAddBlockedRequest(entity: BlockedRequestEntity): Promise<void> {
    await this.db!.query(
      `INSERT INTO ai_security_blocked_requests
        (id, source_ip, user_id, tenant_id, blocked_at, reason, request_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entity.id,
        entity.sourceIp,
        entity.userId,
        entity.tenantId,
        entity.blockedAt,
        entity.reason,
        entity.requestPreview,
      ],
    );
  }

  /**
   * Find blocked requests by filters.
   */
  async findBlockedRequests(filters: BlockedRequestQueryFilters): Promise<BlockedRequestEntity[]> {
    if (this.dbAvailable && this.db) {
      try {
        let query = 'SELECT * FROM ai_security_blocked_requests WHERE 1=1';
        const params: unknown[] = [];
        let paramIdx = 1;

        if (filters.tenantId) {
          query += ` AND tenant_id = $${paramIdx}`;
          params.push(filters.tenantId);
          paramIdx++;
        }
        if (filters.sourceIp) {
          query += ` AND source_ip = $${paramIdx}`;
          params.push(filters.sourceIp);
          paramIdx++;
        }
        if (filters.userId) {
          query += ` AND user_id = $${paramIdx}`;
          params.push(filters.userId);
          paramIdx++;
        }

        query += ' ORDER BY blocked_at DESC';
        if (filters.limit) {
          query += ` LIMIT $${paramIdx}`;
          params.push(filters.limit);
        }

        const result = await this.db!.query(query, params);
        return result.rows.map(this.mapRowToBlockedRequest);
      } catch (err) {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          'ai_security_audit: DB blocked_requests query failed, falling back to in-memory',
        );
        this.dbAvailable = false;
      }
    }

    return this.memory.findBlockedRequests(filters);
  }

  // ---- Cleanup ----

  /**
   * Clean up blocked requests older than retentionMs.
   */
  async cleanupExpired(retentionMs: number): Promise<number> {
    let removedCount = 0;

    if (this.dbAvailable && this.db) {
      try {
        const cutoff = new Date(Date.now() - retentionMs);
        const result = await this.db!.query(
          'DELETE FROM ai_security_blocked_requests WHERE blocked_at < $1 RETURNING id',
          [cutoff],
        );
        removedCount = result.rowCount ?? 0;
      } catch {
        this.dbAvailable = false;
      }
    }

    const memRemoved = this.memory.cleanupExpired(retentionMs);
    removedCount += memRemoved;
    return removedCount;
  }

  // ---- Private Mappers ----

  private mapRowToAuditLog(row: any): AiSecurityAuditLogEntity {
    return {
      id: row.id,
      eventType: row.event_type || 'security_event',
      severity: row.severity || 'info',
      sourceIp: row.source_ip ?? null,
      userId: row.user_id ?? null,
      tenantId: row.tenant_id || 'default',
      action: row.action,
      resource: row.resource ?? null,
      status: row.status || 'recorded',
      details: row.details || {},
      createdAt: row.created_at,
    };
  }

  private mapRowToBlockedRequest(row: any): BlockedRequestEntity {
    return {
      id: row.id,
      sourceIp: row.source_ip,
      userId: row.user_id ?? null,
      tenantId: row.tenant_id || 'default',
      blockedAt: row.blocked_at,
      reason: row.reason,
      requestPreview: row.request_preview ?? null,
    };
  }
}
