import { BaseRepository } from '../db/base-repository';

export interface ErrorBudgetEntity {
  id: string;
  tenantId: string;
  sloId: string;
  totalBudget: number;
  consumed: number;
  remaining: number;
  burnRate: number | null;
  isExhausted: boolean;
  calculatedAt: Date;
}

export class ErrorBudgetRepository extends BaseRepository<ErrorBudgetEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'error_budget');
  }

  async findBySloId(sloId: string): Promise<ErrorBudgetEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM error_budget WHERE slo_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
      [sloId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findHistoryBySloId(sloId: string, limit: number = 30): Promise<ErrorBudgetEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM error_budget WHERE slo_id = $1 ORDER BY calculated_at DESC LIMIT $2`,
      [sloId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findExhausted(tenantId: string): Promise<ErrorBudgetEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM error_budget WHERE tenant_id = $1 AND is_exhausted = true ORDER BY calculated_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ErrorBudgetEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sloId: row.slo_id,
      totalBudget: parseFloat(row.total_budget),
      consumed: parseFloat(row.consumed),
      remaining: parseFloat(row.remaining),
      burnRate: row.burn_rate ? parseFloat(row.burn_rate) : null,
      isExhausted: row.is_exhausted,
      calculatedAt: row.calculated_at,
    };
  }
}
