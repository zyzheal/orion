import { TenantAwareRepository, TenantAwareFindOptions } from '../db/tenant-aware-repository';
import { tenantContext } from '../services/tenant/TenantContext';

export interface BudgetEntity {
  id: string;
  tenantId?: string;
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

export class BudgetRepository extends TenantAwareRepository<BudgetEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'budgets');
  }

  async findByEntity(type: string, scope: string): Promise<BudgetEntity | undefined> {
    const tenantId = this.getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM budgets WHERE type = $1 AND scope = $2 AND status = 'active' AND tenant_id = $3`,
      [type, scope, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateSpent(id: string, spent: number): Promise<void> {
    const tenantId = this.getCurrentTenantId();
    await this.db.query(
      `UPDATE budgets SET spent = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [spent, id, tenantId],
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
      tenantId: row.tenant_id,
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