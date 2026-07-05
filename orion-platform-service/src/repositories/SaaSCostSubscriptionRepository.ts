import { BaseRepository } from '../db/base-repository';

export interface SaaSCostSubscriptionEntity {
  id: string;
  tool: string;
  subscription: string | null;
  seats: number;
  unitCost: number;
  totalCost: number;
  billingCycle: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  notes: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SaaSCostSubscriptionRepository extends BaseRepository<SaaSCostSubscriptionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'saas_cost_subscriptions');
  }

  async findByTool(tool: string): Promise<SaaSCostSubscriptionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM saas_cost_subscriptions WHERE tool = $1 ORDER BY created_at DESC`,
      [tool],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<SaaSCostSubscriptionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM saas_cost_subscriptions WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): SaaSCostSubscriptionEntity {
    return {
      id: row.id,
      tool: row.tool,
      subscription: row.subscription,
      seats: row.seats,
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.total_cost),
      billingCycle: row.billing_cycle,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      notes: row.notes,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
