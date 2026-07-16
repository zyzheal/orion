/**
 * ConfigEventRepository — PostgreSQL data access for config change event bus
 *
 * Stores config.created / config.updated / config.deleted / config.snapshot / config.rollback events.
 */

// No unused imports — logger kept for potential future use

// ============================================================
// Entity Type
// ============================================================

export interface ConfigEventEntity {
  id: string;
  eventType: string;
  domain: string;
  key: string;
  changedBy: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  version: number;
  tenantId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Repository
// ============================================================

export class ConfigEventRepository {
  private tableName = 'config_events';

  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  async create(event: {
    eventType: string;
    domain: string;
    key: string;
    changedBy: string;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
    version?: number;
    tenantId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.tableName}
         (event_type, domain, "key", changed_by, old_value, new_value, version, tenant_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.eventType,
        event.domain,
        event.key,
        event.changedBy,
        event.oldValue,
        event.newValue,
        event.version ?? 1,
        event.tenantId,
        event.metadata ?? {},
      ],
    );
  }

  /**
   * Get recent events ordered by created_at DESC.
   * Falls back to oldest rows when DB limit pushes below maxHistorySize.
   */
  async getHistory(limit: number): Promise<ConfigEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getEventsByType(domain: string, eventType: string, limit: number = 50): Promise<ConfigEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE domain = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT $3`,
      [domain, eventType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getEventsByDomain(domain: string, limit: number = 50): Promise<ConfigEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE domain = $1 ORDER BY created_at DESC LIMIT $2`,
      [domain, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByType(domain: string, eventType: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) AS cnt FROM ${this.tableName} WHERE domain = $1 AND event_type = $2`,
      [domain, eventType],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  protected mapRowToEntity(row: any): ConfigEventEntity {
    return {
      id: row.id,
      eventType: row.event_type,
      domain: row.domain,
      key: row.key,
      changedBy: row.changed_by,
      oldValue: this.parseJsonObject(row.old_value),
      newValue: this.parseJsonObject(row.new_value),
      version: row.version ?? 1,
      tenantId: row.tenant_id,
      metadata: this.parseJsonObject(row.metadata) ?? {},
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return raw as Record<string, unknown>;
  }
}
