import { BaseRepository } from '../db/base-repository';

export interface BudgetSpendEntity {
  id: string;
  entityType: string;
  entityId: string;
  amount: number;
  recordedAt: Date;
  windowStart: Date | null;
  windowEnd: Date | null;
  tenantId: string | null;
  createdAt: Date;
}

export class BudgetSpendRepository extends BaseRepository<BudgetSpendEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'budget_spend_records');
  }

  async findByEntity(entityType: string, entityId: string): Promise<BudgetSpendEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM budget_spend_records WHERE entity_type = $1 AND entity_id = $2 ORDER BY recorded_at DESC`,
      [entityType, entityId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getTotalSpend(entityType: string, entityId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM budget_spend_records WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
    );
    return Number(result.rows[0]?.total || 0);
  }

  protected mapRowToEntity(row: any): BudgetSpendEntity {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      amount: Number(row.amount),
      recordedAt: row.recorded_at,
      windowStart: row.window_start,
      windowEnd: row.window_end,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
    };
  }
}
