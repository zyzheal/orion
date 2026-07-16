/**
 * BudgetRepository - Data access for finops_budget table
 *
 * Manages cost budgets with scope-based allocation and alert thresholds.
 * Tenant filtering via RLS + getCurrentTenantId() for explicit WHERE clauses.
 */

import { getCurrentTenantId } from '../../../db/tenant-context-storage';

export interface Budget {
  id: string;
  tenant_id: string;
  name: string;
  scope_type: string;
  scope_value: string;
  monthly_limit: number;
  alert_threshold: number;
  currency: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetOverrun {
  budget_id: string;
  budget_name: string;
  scope_type: string;
  scope_value: string;
  monthly_limit: number;
  actual_cost: number;
  usage_ratio: number;
  exceeded: boolean;
}

type DbConnection = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export class BudgetRepository {
  constructor(private db: DbConnection) {}

  async getBudgets(): Promise<Budget[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      'SELECT * FROM finops_budget WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
    return result.rows;
  }

  async getBudget(id: string): Promise<Budget | null> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      'SELECT * FROM finops_budget WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] || null;
  }

  async createBudget(data: {
    name: string;
    scope_type: string;
    scope_value: string;
    monthly_limit: number;
    alert_threshold?: number;
    currency?: string;
    enabled?: boolean;
  }): Promise<Budget> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO finops_budget
         (tenant_id, name, scope_type, scope_value, monthly_limit, alert_threshold, currency, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.scope_type,
        data.scope_value,
        data.monthly_limit,
        data.alert_threshold ?? 0.8,
        data.currency ?? 'CNY',
        data.enabled ?? true,
      ],
    );
    return result.rows[0];
  }

  async updateBudget(id: string, data: {
    name?: string;
    scope_type?: string;
    scope_value?: string;
    monthly_limit?: number;
    alert_threshold?: number;
    currency?: string;
    enabled?: boolean;
  }): Promise<Budget | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name); }
    if (data.scope_type !== undefined) { sets.push(`scope_type = $${idx++}`); params.push(data.scope_type); }
    if (data.scope_value !== undefined) { sets.push(`scope_value = $${idx++}`); params.push(data.scope_value); }
    if (data.monthly_limit !== undefined) { sets.push(`monthly_limit = $${idx++}`); params.push(data.monthly_limit); }
    if (data.alert_threshold !== undefined) { sets.push(`alert_threshold = $${idx++}`); params.push(data.alert_threshold); }
    if (data.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(data.currency); }
    if (data.enabled !== undefined) { sets.push(`enabled = $${idx++}`); params.push(data.enabled); }

    if (sets.length === 0) return this.getBudget(id);

    const tenantId = getCurrentTenantId();
    sets.push(`updated_at = NOW()`);
    params.push(id);
    params.push(tenantId);

    const result = await this.db.query(
      `UPDATE finops_budget SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  }

  async deleteBudget(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      'DELETE FROM finops_budget WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async checkOverrun(month: string): Promise<BudgetOverrun[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT
         b.id AS budget_id,
         b.name AS budget_name,
         b.scope_type,
         b.scope_value,
         b.monthly_limit,
         COALESCE(SUM(
           CASE
             WHEN b.scope_type = 'cluster' THEN cc.total_cost
             WHEN b.scope_type = 'namespace' THEN nc.total_cost
             ELSE 0
           END
         ), 0) AS actual_cost,
         CASE
           WHEN b.monthly_limit > 0 THEN
             COALESCE(SUM(
               CASE
                 WHEN b.scope_type = 'cluster' THEN cc.total_cost
                 WHEN b.scope_type = 'namespace' THEN nc.total_cost
                 ELSE 0
               END
             ), 0) / b.monthly_limit
           ELSE 0
         END AS usage_ratio,
         CASE
           WHEN b.monthly_limit > 0 THEN
             COALESCE(SUM(
               CASE
                 WHEN b.scope_type = 'cluster' THEN cc.total_cost
                 WHEN b.scope_type = 'namespace' THEN nc.total_cost
                 ELSE 0
               END
             ), 0) > b.monthly_limit
           ELSE false
         END AS exceeded
       FROM finops_budget b
       LEFT JOIN k8s_cluster_cost cc
         ON b.scope_type = 'cluster' AND cc.tenant_id = b.tenant_id
         AND cc.cluster_name = b.scope_value AND cc.month = $2
       LEFT JOIN k8s_namespace_cost nc
         ON b.scope_type = 'namespace' AND nc.tenant_id = b.tenant_id
         AND nc.namespace = b.scope_value AND nc.month = $2
       WHERE b.tenant_id = $1 AND b.enabled = true
       GROUP BY b.id, b.name, b.scope_type, b.scope_value, b.monthly_limit
       ORDER BY usage_ratio DESC`,
      [tenantId, month],
    );
    return result.rows;
  }
}
