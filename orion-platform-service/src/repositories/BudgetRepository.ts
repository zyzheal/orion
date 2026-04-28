import { BaseRepository } from '../db/base-repository';

export interface BudgetEntity {
  id: string;
  name: string;
  type: string;
  scope: string;
  period: string;
  amount: number;
  thresholds: Record<string, number>;
  status: string;
  spent: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetRepository extends BaseRepository<BudgetEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'budgets');
  }

  async findByEntity(type: string, scope: string): Promise<BudgetEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM budgets WHERE type = $1 AND scope = $2 AND status = 'active'`,
      [type, scope],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateSpent(id: string, spent: number): Promise<void> {
    await this.db.query(
      `UPDATE budgets SET spent = $1, updated_at = NOW() WHERE id = $2`,
      [spent, id],
    );
  }

  async updateSpentWithClient(id: string, spent: number, client: any): Promise<void> {
    await client.query(
      `UPDATE budgets SET spent = $1, updated_at = NOW() WHERE id = $2`,
      [spent, id],
    );
  }

  async updateWithClient(id: string, updates: { status?: string; updatedAt?: Date }, client: any): Promise<void> {
    await client.query(
      `UPDATE budgets SET status = $1, updated_at = $2 WHERE id = $3`,
      [updates.status, updates.updatedAt, id],
    );
  }

  protected mapRowToEntity(row: any): BudgetEntity {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      scope: row.scope,
      period: row.period,
      amount: row.amount,
      thresholds: row.thresholds ?? {},
      status: row.status,
      spent: row.spent ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}