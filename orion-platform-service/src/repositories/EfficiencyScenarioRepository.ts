/**
 * EfficiencyScenarioRepository
 * Data access layer for efficiency dashboard scenarios.
 * Replaces in-memory Map<string, EfficiencyScenario> in EfficiencyDashboardService.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';
import { EfficiencyScenario, DashboardWidget, TimeRange, ScenarioSummary } from '../services/efficiency/EfficiencyDashboardService';

export interface EfficiencyScenarioEntity {
  id: string;
  tenantId: string;
  scenarioId: string;
  name: string;
  description: string;
  category: string;
  widgets: DashboardWidget[];
  timeRange: TimeRange;
  summary: ScenarioSummary;
  cacheKey: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class EfficiencyScenarioRepository extends BaseRepository<EfficiencyScenarioEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'efficiency_scenarios');
  }

  async create(data: any): Promise<EfficiencyScenarioEntity> {
    const columns = ['id', 'tenant_id', 'scenario_id', 'name', 'description', 'category', 'widgets', 'time_range', 'summary', 'cache_key', 'expires_at'];
    const values = [
      data.id,
      data.tenantId || 'default',
      data.scenarioId,
      data.name,
      data.description || '',
      data.category || 'overview',
      JSON.stringify(data.widgets || []),
      JSON.stringify(data.timeRange || {}),
      JSON.stringify(data.summary || {}),
      data.cacheKey,
      data.expiresAt || new Date(Date.now() + 60 * 60 * 1000),
    ];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByCacheKey(cacheKey: string): Promise<EfficiencyScenarioEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByScenarioId(scenarioId: string, tenantId?: string): Promise<EfficiencyScenarioEntity | undefined> {
    let query = `SELECT * FROM ${this.tableName} WHERE scenario_id = $1 AND expires_at > NOW()`;
    const params: any[] = [scenarioId];
    if (tenantId) {
      query += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    query += ` ORDER BY created_at DESC LIMIT 1`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  async findByTenant(tenantId: string, limit: number = 20): Promise<EfficiencyScenarioEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EfficiencyScenarioEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      scenarioId: row.scenario_id,
      name: row.name,
      description: row.description,
      category: row.category,
      widgets: (row.widgets || []) as DashboardWidget[],
      timeRange: (row.time_range || {}) as TimeRange,
      summary: (row.summary || {}) as ScenarioSummary,
      cacheKey: row.cache_key,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
