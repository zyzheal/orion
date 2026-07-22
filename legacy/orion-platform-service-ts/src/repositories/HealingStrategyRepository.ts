import { BaseRepository } from '../db/base-repository';

export interface HealingStrategyEntity {
  id: string;
  name: string;
  triggerType: string;
  actions: any[];
  conditions: any[];
  confidence: number;
  enabled: boolean;
  description: string | null;
  environments: string[] | null;
  maxRetries: number | null;
  retryCooldownMs: number | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class HealingStrategyRepository extends BaseRepository<HealingStrategyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'healing_strategies');
  }

  async findByTriggerType(triggerType: string, tenantId?: string): Promise<HealingStrategyEntity[]> {
    let query = `SELECT * FROM healing_strategies WHERE (trigger_type = $1 OR trigger_type = 'any')`;
    const params: any[] = [triggerType];
    if (tenantId) {
      query += ` AND (tenant_id = $2 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY confidence DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(tenantId?: string): Promise<HealingStrategyEntity[]> {
    let query = `SELECT * FROM healing_strategies WHERE enabled = true`;
    const params: any[] = [];
    if (tenantId) {
      query += ` AND (tenant_id = $1 OR tenant_id IS NULL)`;
      params.push(tenantId);
    }
    query += ` ORDER BY confidence DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async enableStrategy(id: string): Promise<HealingStrategyEntity | undefined> {
    const result = await this.db.query(
      `UPDATE healing_strategies SET enabled = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async disableStrategy(id: string): Promise<HealingStrategyEntity | undefined> {
    const result = await this.db.query(
      `UPDATE healing_strategies SET enabled = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): HealingStrategyEntity {
    return {
      id: row.id,
      name: row.name,
      triggerType: row.trigger_type,
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions || []),
      conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || []),
      confidence: row.confidence,
      enabled: row.enabled,
      description: row.description,
      environments: typeof row.environments === 'string' ? JSON.parse(row.environments) : row.environments,
      maxRetries: row.max_retries,
      retryCooldownMs: row.retry_cooldown_ms,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
