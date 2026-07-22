/**
 * ConfigFallbackRepository - PostgreSQL persistence for fallback configs
 */

import { BaseRepository } from '../db/base-repository';

export interface ConfigFallbackEntity {
  id: string;
  domain: string;
  key: string;
  fallbackValue: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RawFallbackRow {
  id: string;
  domain: string;
  key: string;
  fallback_value: unknown;
  priority: number;
  enabled: boolean;
  tenant_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class ConfigFallbackRepository extends BaseRepository<ConfigFallbackEntity> {
  private dbAvailable: boolean;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null,
  ) {
    const dummyDb = {
      query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    };
    super(db || dummyDb, 'config_fallback');
    this.dbAvailable = db !== null;
  }

  isDbAvailable(): boolean {
    return this.dbAvailable;
  }

  protected mapRowToEntity(row: RawFallbackRow): ConfigFallbackEntity {
    return {
      id: row.id,
      domain: row.domain,
      key: row.key,
      fallbackValue: this._parseJson(row.fallback_value) || {},
      priority: parseInt(String(row.priority), 10) || 0,
      enabled: Boolean(row.enabled),
      tenantId: row.tenant_id || undefined,
      createdAt: this._toDate(row.created_at),
      updatedAt: this._toDate(row.updated_at),
    };
  }

  private _parseJson(val: unknown): Record<string, unknown> | null {
    if (val === undefined || val === null) return {};
    if (typeof val === 'object') return val as Record<string, unknown>;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return {}; }
    }
    return {};
  }

  private _toDate(v: unknown): Date {
    if (v instanceof Date) return v;
    if (typeof v === 'string') return new Date(v);
    return new Date();
  }

  /**
   * Find fallback value by domain and key, ordered by priority DESC then enabled ASC
   */
  async findByDomainKey(domain: string, key: string, tenantId?: string): Promise<ConfigFallbackEntity | null> {
    if (!this.dbAvailable) return null;

    let query = `SELECT * FROM config_fallback WHERE domain = $1 AND key = $2 AND enabled = true`;
    const params: unknown[] = [domain, key];
    let paramIdx = 3;

    if (tenantId) {
      query += ` AND (tenant_id = $${paramIdx} OR tenant_id IS NULL)`;
      params.push(tenantId);
      paramIdx++;
    }

    query += ` ORDER BY priority DESC LIMIT 1`;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Upsert: insert or update on conflict of (domain, key, tenant_id)
   */
  async upsert(domain: string, key: string, value: Record<string, unknown>, priority?: number, tenantId?: string): Promise<void> {
    if (!this.dbAvailable) return;

    const upsertPriority = priority ?? 0;

    await this.db.query(
      `INSERT INTO config_fallback (domain, key, fallback_value, priority, tenant_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (domain, key)
       DO UPDATE SET
         fallback_value = EXCLUDED.fallback_value,
         priority = EXCLUDED.priority,
         tenant_id = EXCLUDED.tenant_id,
         updated_at = NOW()`,
      [domain, key, JSON.stringify(value), upsertPriority, tenantId ?? null],
    );
  }

  /**
   * Mark a key as disabled (soft disable)
   */
  async disable(domain: string, key: string, tenantId?: string): Promise<void> {
    if (!this.dbAvailable) return;

    let query = `UPDATE config_fallback SET enabled = false, updated_at = NOW() WHERE domain = $1 AND key = $2`;
    const params: unknown[] = [domain, key];
    let paramIdx = 3;

    if (tenantId) {
      query += ` AND (tenant_id = $${paramIdx} OR tenant_id IS NULL)`;
      params.push(tenantId);
      paramIdx++;
    }

    await this.db.query(query, params);
  }

  /**
   * Delete a fallback config entry
   */
  async deleteConfig(domain: string, key: string, tenantId?: string): Promise<void> {
    if (!this.dbAvailable) return;

    let query = `DELETE FROM config_fallback WHERE domain = $1 AND key = $2`;
    const params: unknown[] = [domain, key];
    let paramIdx = 3;

    if (tenantId) {
      query += ` AND (tenant_id = $${paramIdx} OR tenant_id IS NULL)`;
      params.push(tenantId);
      paramIdx++;
    }

    await this.db.query(query, params);
  }

  /**
   * Delete a fallback config entry by ID (overrides BaseRepository.delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM config_fallback WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Load all fallback configs for cache warmup
   */
  async loadAll(): Promise<ConfigFallbackEntity[]> {
    if (!this.dbAvailable) return [];

    const result = await this.db.query(
      `SELECT * FROM config_fallback WHERE enabled = true ORDER BY priority DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }
}
