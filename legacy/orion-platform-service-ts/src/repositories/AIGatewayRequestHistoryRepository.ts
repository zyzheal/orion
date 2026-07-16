/**
 * AIGateway Request History Repository
 *
 * PostgreSQL persistence for AI Gateway request history (used for P95 latency calculation).
 */
import { BaseRepository } from '../db/base-repository';

export interface AIGatewayRequestHistoryEntity {
  id: string;
  scenario: string;
  latency: number;
  success: boolean;
  request_time: Date;
  tenant_id: string | null;
  created_at: Date;
}

export class AIGatewayRequestHistoryRepository extends BaseRepository<AIGatewayRequestHistoryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_gateway_request_history');
  }

  async findByScenario(scenario: string, limit: number = 100): Promise<AIGatewayRequestHistoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_gateway_request_history WHERE scenario = $1 ORDER BY request_time DESC LIMIT $2`,
      [scenario, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async countByScenario(scenario: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ai_gateway_request_history WHERE scenario = $1`,
      [scenario],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async deleteByScenario(scenario: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_gateway_request_history WHERE scenario = $1`,
      [scenario],
    );
    return result.rowCount ?? 0;
  }

  async pruneOldRecords(scenario: string, keepCount: number): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_gateway_request_history WHERE id IN (
        SELECT id FROM ai_gateway_request_history
        WHERE scenario = $1
        ORDER BY request_time DESC
        OFFSET $2
      )`,
      [scenario, keepCount],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AIGatewayRequestHistoryEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      latency: parseInt(row.latency) || 0,
      success: row.success === true || row.success === 'true',
      request_time: row.request_time,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
    };
  }
}
