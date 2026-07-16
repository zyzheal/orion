/**
 * AIGateway Circuit State Repository
 *
 * PostgreSQL persistence for AI Gateway per-scenario circuit breaker states.
 */
import { BaseRepository } from '../db/base-repository';

export interface AIGatewayCircuitStateEntity {
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

export class AIGatewayCircuitStateRepository extends BaseRepository<AIGatewayCircuitStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_gateway_circuit_states');
  }

  async findByScenario(scenario: string): Promise<AIGatewayCircuitStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_gateway_circuit_states WHERE scenario = $1 LIMIT 1`,
      [scenario],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsertByScenario(data: {
    scenario: string;
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastStateChangeTime: Date;
    halfOpenAttempts: number;
    tenantId?: string;
  }): Promise<AIGatewayCircuitStateEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_gateway_circuit_states (id, scenario, state, failure_count, success_count, last_failure_time, last_state_change_time, half_open_attempts, tenant_id)
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
        data.scenario,
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

  async listAll(): Promise<AIGatewayCircuitStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_gateway_circuit_states ORDER BY scenario`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AIGatewayCircuitStateEntity {
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
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
