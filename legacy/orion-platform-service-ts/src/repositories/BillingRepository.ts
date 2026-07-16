/**
 * BillingRepository - PostgreSQL data access for billing_usage_records and billing_records
 *
 * Migrated from in-memory Map() storage to PostgreSQL Repository pattern.
 */

import { DatabasePool } from '../services/database';

export interface UsageRecordEntity {
  id: string;
  tenantId: string;
  service: string;
  metric: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  periodStart: string;
  periodEnd: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface BillingRecordEntity {
  id: string;
  tenantId: string;
  billingPeriod: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  paidAt: Date | null;
  items: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageFindFilter {
  service?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface BillingFindFilter {
  status?: string;
  period?: string;
}

export class BillingRepository {
  constructor(private pool: DatabasePool) {}

  // ==================== Usage Records ====================

  async createUsageRecord(
    data: { service: string; metric: string; quantity: number; unitPrice: number; totalCost: number; periodStart: string; periodEnd: string; metadata?: Record<string, any> },
    tenantId: string,
  ): Promise<UsageRecordEntity> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO billing_usage_records (id, tenant_id, service, metric, quantity, unit_price, total_cost, period_start, period_end, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, tenantId, data.service, data.metric, data.quantity, data.unitPrice, data.totalCost, data.periodStart, data.periodEnd, JSON.stringify(data.metadata ?? {})],
    );
    return this.rowToUsageEntity(result.rows[0]);
  }

  async findAllUsageRecords(): Promise<UsageRecordEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM billing_usage_records ORDER BY created_at DESC',
    );
    return result.rows.map((row: any) => this.rowToUsageEntity(row));
  }

  async findAllBillingRecords(): Promise<BillingRecordEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM billing_records ORDER BY created_at DESC',
    );
    return result.rows.map((row: any) => this.rowToBillingEntity(row));
  }

  async findUsageByTenant(tenantId: string, filter: UsageFindFilter = {}): Promise<UsageRecordEntity[]> {
    let query = 'SELECT * FROM billing_usage_records WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];

    if (filter.service) {
      params.push(filter.service);
      query += ` AND service = $${params.length}`;
    }
    if (filter.periodStart) {
      params.push(filter.periodStart);
      query += ` AND period_start >= $${params.length}`;
    }
    if (filter.periodEnd) {
      params.push(filter.periodEnd);
      query += ` AND period_end <= $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map((row: any) => this.rowToUsageEntity(row));
  }

  async getUsageSummary(tenantId: string, period: string): Promise<{ totalCost: number; byService: Record<string, number> }> {
    const result = await this.pool.query(
      `SELECT service, COALESCE(SUM(total_cost), 0) as cost
       FROM billing_usage_records
       WHERE tenant_id = $1 AND period_start::text LIKE $2
       GROUP BY service
       ORDER BY cost DESC`,
      [tenantId, `${period}%`],
    );

    const byService: Record<string, number> = {};
    let totalCost = 0;

    for (const row of result.rows) {
      const cost = parseFloat(row.cost);
      byService[row.service] = cost;
      totalCost += cost;
    }

    return { totalCost, byService };
  }

  // ==================== Billing Records ====================

  async createBillingRecord(
    data: { tenantId: string; billingPeriod: string; status: string; totalAmount: number; paidAmount: number; dueDate?: string; items?: Record<string, any> },
  ): Promise<BillingRecordEntity> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO billing_records (id, tenant_id, billing_period, status, total_amount, paid_amount, due_date, items)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, data.tenantId, data.billingPeriod, data.status, data.totalAmount, data.paidAmount, data.dueDate ?? null, JSON.stringify(data.items ?? [])],
    );
    return this.rowToBillingEntity(result.rows[0]);
  }

  async findBillingRecords(tenantId: string, filter: BillingFindFilter = {}): Promise<BillingRecordEntity[]> {
    let query = 'SELECT * FROM billing_records WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];

    if (filter.status) {
      params.push(filter.status);
      query += ` AND status = $${params.length}`;
    }
    if (filter.period) {
      params.push(filter.period);
      query += ` AND billing_period = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map((row: any) => this.rowToBillingEntity(row));
  }

  async findBillingRecordById(id: string): Promise<BillingRecordEntity | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM billing_records WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.rowToBillingEntity(result.rows[0]);
  }

  async updateBillingRecord(id: string, updates: Partial<{ status: string; totalAmount: number; paidAmount: number; paidAt: string | null; dueDate: string; items: Record<string, any> }>): Promise<BillingRecordEntity | undefined> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.totalAmount !== undefined) {
      setClauses.push(`total_amount = $${paramIndex++}`);
      values.push(updates.totalAmount);
    }
    if (updates.paidAmount !== undefined) {
      setClauses.push(`paid_amount = $${paramIndex++}`);
      values.push(updates.paidAmount);
    }
    if (updates.paidAt !== undefined) {
      setClauses.push(`paid_at = $${paramIndex++}`);
      values.push(updates.paidAt);
    }
    if (updates.dueDate !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`);
      values.push(updates.dueDate);
    }
    if (updates.items !== undefined) {
      setClauses.push(`items = $${paramIndex++}`);
      values.push(JSON.stringify(updates.items));
    }

    if (setClauses.length === 0) return this.findBillingRecordById(id);

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE billing_records SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return undefined;
    return this.rowToBillingEntity(result.rows[0]);
  }

  async getBillingSummary(tenantId: string): Promise<{
    totalBilling: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    currentMonthCost: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) as total_billing,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount - paid_amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN total_amount - paid_amount ELSE 0 END), 0) as overdue_amount
       FROM billing_records
       WHERE tenant_id = $1`,
      [tenantId],
    );

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthResult = await this.pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as current_month_cost
       FROM billing_records
       WHERE tenant_id = $1 AND billing_period = $2`,
      [tenantId, currentMonth],
    );

    const row = result.rows[0];
    return {
      totalBilling: parseFloat(row.total_billing),
      paidAmount: parseFloat(row.paid_amount),
      pendingAmount: parseFloat(row.pending_amount),
      overdueAmount: parseFloat(row.overdue_amount),
      currentMonthCost: parseFloat(monthResult.rows[0]?.current_month_cost ?? '0'),
    };
  }

  // ==================== Row Mappers ====================

  private rowToUsageEntity(row: any): UsageRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      service: row.service,
      metric: row.metric,
      quantity: parseFloat(row.quantity),
      unitPrice: parseFloat(row.unit_price),
      totalCost: parseFloat(row.total_cost),
      periodStart: row.period_start instanceof Date ? row.period_start.toISOString() : row.period_start,
      periodEnd: row.period_end instanceof Date ? row.period_end.toISOString() : row.period_end,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      createdAt: row.created_at,
    };
  }

  private rowToBillingEntity(row: any): BillingRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      billingPeriod: row.billing_period,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      paidAmount: parseFloat(row.paid_amount),
      dueDate: row.due_date,
      paidAt: row.paid_at,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items ?? []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
