import { DatabasePool } from '../database';
/**
 * CostRepository - Database layer for Cost/FinOps operations
 */


export interface CostRecord {
  id: string;
  tenant_id: string;
  date: Date;
  service: string;
  resource_id: string | null;
  region: string | null;
  cost: number;
  currency: string;
  tags: Record<string, string>;
  created_at: Date;
}

export interface Budget {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  period: string;
  alert_threshold: number;
  current_spend: number;
  created_at: Date;
}

export interface CostAggregation {
  service: string;
  total_cost: number;
  count: number;
}

export class CostRepository {
  constructor(private pool: DatabasePool) {}

  async findAll(options?: { tenantId?: string; startDate?: Date; endDate?: Date; service?: string; limit?: number; offset?: number }): Promise<CostRecord[]> {
    let query = 'SELECT * FROM cost_records WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.tenantId) { params.push(options.tenantId); query += ` AND tenant_id = $${paramIndex++}`; }
    if (options?.startDate) { params.push(options.startDate); query += ` AND date >= $${paramIndex++}`; }
    if (options?.endDate) { params.push(options.endDate); query += ` AND date <= $${paramIndex++}`; }
    if (options?.service) { params.push(options.service); query += ` AND service = $${paramIndex++}`; }
    
    query += ' ORDER BY date DESC';
    if (options?.limit) { params.push(options.limit); query += ` LIMIT $${paramIndex++}`; }
    if (options?.offset) { params.push(options.offset); query += ` OFFSET $${paramIndex++}`; }

    return (await this.pool.query(query, params)).rows;
  }

  async createCostRecord(tenantId: string, date: Date, service: string, cost: number, resourceId?: string, region?: string, tags?: Record<string, string>): Promise<CostRecord> {
    const result = await this.pool.query(
      `INSERT INTO cost_records (tenant_id, date, service, resource_id, region, cost, currency, tags)
       VALUES ($1, $2, $3, $4, $5, $6, 'USD', $7) RETURNING *`,
      [tenantId, date, service, resourceId || null, region || null, cost, tags || {}]
    );
    return result.rows[0];
  }

  async getCostByService(tenantId: string, startDate: Date, endDate: Date): Promise<CostAggregation[]> {
    return (await this.pool.query(
      `SELECT service, SUM(cost) as total_cost, COUNT(*) as count
       FROM cost_records
       WHERE tenant_id = $1 AND date >= $2 AND date <= $3
       GROUP BY service
       ORDER BY total_cost DESC`,
      [tenantId, startDate, endDate]
    )).rows;
  }

  async getTotalCost(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.pool.query(
      'SELECT COALESCE(SUM(cost), 0) as total FROM cost_records WHERE tenant_id = $1 AND date >= $2 AND date <= $3',
      [tenantId, startDate, endDate]
    );
    return parseFloat(result.rows[0].total);
  }

  // Budget operations
  async findBudgetById(id: string): Promise<Budget | null> {
    return (await this.pool.query('SELECT * FROM budgets WHERE id = $1', [id])).rows[0] || null;
  }

  async findAllBudgets(tenantId?: string): Promise<Budget[]> {
    let query = 'SELECT * FROM budgets';
    const params: any[] = [];
    if (tenantId) { params.push(tenantId); query += ' WHERE tenant_id = $1'; }
    query += ' ORDER BY created_at DESC';
    return (await this.pool.query(query, params)).rows;
  }

  async createBudget(tenantId: string, name: string, amount: number, period: string, alertThreshold: number): Promise<Budget> {
    const result = await this.pool.query(
      `INSERT INTO budgets (tenant_id, name, amount, period, alert_threshold, current_spend)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING *`,
      [tenantId, name, amount, period, alertThreshold]
    );
    return result.rows[0];
  }

  async updateBudgetSpend(id: string, spend: number): Promise<Budget | null> {
    const result = await this.pool.query(
      'UPDATE budgets SET current_spend = $1 WHERE id = $2 RETURNING *',
      [spend, id]
    );
    return result.rows[0] || null;
  }

  async getBudgetAlerts(tenantId: string): Promise<Budget[]> {
    return (await this.pool.query(
      'SELECT * FROM budgets WHERE tenant_id = $1 AND current_spend >= (amount * alert_threshold / 100)',
      [tenantId]
    )).rows;
  }
}