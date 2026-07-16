/**
 * CircuitBreakerManager Repository
 *
 * PostgreSQL persistence for CircuitBreakerManager scenario states and provider configs.
 */
import { BaseRepository } from '../db/base-repository';

export interface CBManagerScenarioStateEntity {
  id: string;
  scenario: string;
  state: string;
  failure_count: number;
  success_count: number;
  last_failure_time: Date | null;
  last_state_change_time: Date;
  half_open_attempts: number;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class CBManagerScenarioStateRepository extends BaseRepository<CBManagerScenarioStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_cb_manager_scenario_states');
  }

  async findByScenario(scenario: string): Promise<CBManagerScenarioStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_cb_manager_scenario_states WHERE scenario = $1 LIMIT 1`,
      [scenario],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<CBManagerScenarioStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_cb_manager_scenario_states ORDER BY scenario`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByScenario(data: {
    id: string;
    scenario: string;
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastStateChangeTime: Date;
    halfOpenAttempts: number;
    tenantId?: string;
  }): Promise<CBManagerScenarioStateEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_cb_manager_scenario_states (id, scenario, state, failure_count, success_count, last_failure_time, last_state_change_time, half_open_attempts, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (scenario) DO UPDATE SET
         state = EXCLUDED.state,
         failure_count = EXCLUDED.failure_count,
         success_count = EXCLUDED.success_count,
         last_failure_time = EXCLUDED.last_failure_time,
         last_state_change_time = EXCLUDED.last_state_change_time,
         half_open_attempts = EXCLUDED.half_open_attempts,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.scenario,
        data.state,
        data.failureCount,
        data.successCount,
        data.lastFailureTime || null,
        data.lastStateChangeTime,
        data.halfOpenAttempts,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByScenario(scenario: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ai_cb_manager_scenario_states WHERE scenario = $1`,
      [scenario],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CBManagerScenarioStateEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      state: row.state || 'CLOSED',
      failure_count: parseInt(row.failure_count) || 0,
      success_count: parseInt(row.success_count) || 0,
      last_failure_time: row.last_failure_time,
      last_state_change_time: row.last_state_change_time,
      half_open_attempts: parseInt(row.half_open_attempts) || 0,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

/**
 * CBManagerProvider Entity
 */
export interface CBManagerProviderEntity {
  id: string;
  provider_id: string;
  name: string;
  type: string;
  priority: number;
  enabled: boolean;
  config_json: Record<string, unknown>;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class CBManagerProviderRepository extends BaseRepository<CBManagerProviderEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_cb_manager_providers');
  }

  async findByProviderId(providerId: string): Promise<CBManagerProviderEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_cb_manager_providers WHERE provider_id = $1 LIMIT 1`,
      [providerId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<CBManagerProviderEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_cb_manager_providers ORDER BY priority`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async listEnabled(): Promise<CBManagerProviderEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_cb_manager_providers WHERE enabled = true ORDER BY priority`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByProviderId(data: {
    id: string;
    providerId: string;
    name: string;
    type: string;
    priority: number;
    enabled: boolean;
    configJson?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<CBManagerProviderEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_cb_manager_providers (id, provider_id, name, type, priority, enabled, config_json, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (provider_id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         priority = EXCLUDED.priority,
         enabled = EXCLUDED.enabled,
         config_json = EXCLUDED.config_json,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.providerId,
        data.name,
        data.type,
        data.priority,
        data.enabled,
        data.configJson ? JSON.stringify(data.configJson) : '{}',
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByProviderId(providerId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ai_cb_manager_providers WHERE provider_id = $1`,
      [providerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CBManagerProviderEntity {
    return {
      id: row.id,
      provider_id: row.provider_id,
      name: row.name,
      type: row.type,
      priority: parseInt(row.priority) || 100,
      enabled: row.enabled === true || row.enabled === 'true',
      config_json: typeof row.config_json === 'string' ? JSON.parse(row.config_json) : (row.config_json ?? {}),
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
