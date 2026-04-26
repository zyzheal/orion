/**
 * PolicyRepository - Database layer for Policy operations
 */

import { DatabasePool } from '../database';

export interface PolicyDefinition {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  effect: string;
  rego_code: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PolicyBundle {
  id: string;
  tenant_id: string;
  name: string;
  version: string;
  policies: string[];
  created_at: Date;
}

export interface PolicyEvaluation {
  id: string;
  tenant_id: string;
  policy_id: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  decision: string;
  eval_input: Record<string, any>;
  result: Record<string, any>;
  created_at: Date;
}

export class PolicyRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async findPolicyById(id: string): Promise<PolicyDefinition | null> {
    const result = await this.pool.query('SELECT * FROM policies WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAllPolicies(tenantId?: string): Promise<PolicyDefinition[]> {
    let query = 'SELECT * FROM policies';
    const params: any[] = [];
    if (tenantId) { params.push(tenantId); query += ' WHERE tenant_id = $1'; }
    query += ' ORDER BY created_at DESC';
    return (await this.pool.query(query, params)).rows;
  }

  async createPolicy(tenantId: string, name: string, resource: string, action: string, regoCode: string, effect: string = 'allow'): Promise<PolicyDefinition> {
    const result = await this.pool.query(
      `INSERT INTO policies (tenant_id, name, resource, action, effect, rego_code, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [tenantId, name, resource, action, effect, regoCode]
    );
    return result.rows[0];
  }

  async updatePolicy(id: string, input: { name?: string; rego_code?: string; enabled?: boolean }): Promise<PolicyDefinition | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (input.name !== undefined) { params.push(input.name); updates.push(`name = $${paramIndex++}`); }
    if (input.rego_code !== undefined) { params.push(input.rego_code); updates.push(`rego_code = $${paramIndex++}`); }
    if (input.enabled !== undefined) { params.push(input.enabled); updates.push(`enabled = $${paramIndex++}`); }
    if (updates.length === 0) return this.findPolicyById(id);
    params.push(id);
    const result = await this.pool.query(`UPDATE policies SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`, params);
    return result.rows[0] || null;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM policies WHERE id = $1', [id]);
    return result.rowCount > 0;
  }

  async createEvaluation(tenantId: string, policyId: string | null, resourceType: string, resourceId: string, action: string, decision: string, evalInput: Record<string, any>, result: Record<string, any>): Promise<PolicyEvaluation> {
    const res = await this.pool.query(
      `INSERT INTO policy_evaluations (tenant_id, policy_id, resource_type, resource_id, action, decision, eval_input, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, policyId, resourceType, resourceId, action, decision, evalInput, result]
    );
    return res.rows[0];
  }

  async findEvaluations(tenantId: string, limit: number = 100): Promise<PolicyEvaluation[]> {
    return (await this.pool.query(
      'SELECT * FROM policy_evaluations WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit]
    )).rows;
  }
}