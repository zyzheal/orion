/**
 * AuditRuleRepository - 审计规则数据访问层
 * PostgreSQL Repository pattern implementation
 */

import type { AuditRule } from '../types/dba.js';
import type { IDbAdapter } from '../db/database.js';

function rowToAuditRule(row: any): AuditRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    rules: (row.rules as Record<string, unknown>) || {},
    enabled: row.enabled,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class AuditRuleRepository {
  constructor(private pool: IDbAdapter) {}

  async create(input: {
    name: string;
    description?: string;
    rules: Record<string, unknown>;
    enabled: boolean;
    tenantId: string;
  }): Promise<AuditRule> {
    const result = await this.pool.query(
      `INSERT INTO audit_rules (id, name, description, rules, enabled, tenant_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
       RETURNING *`,
      [input.name, input.description || null, JSON.stringify(input.rules), input.enabled, input.tenantId],
    );
    return rowToAuditRule(result.rows[0]);
  }

  async findById(id: string): Promise<AuditRule | null> {
    const result = await this.pool.query('SELECT * FROM audit_rules WHERE id = $1', [id]);
    return result.rows[0] ? rowToAuditRule(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string): Promise<AuditRule[]> {
    const result = await this.pool.query(
      'SELECT * FROM audit_rules WHERE tenant_id = $1 ORDER BY name',
      [tenantId],
    );
    return result.rows.map(rowToAuditRule);
  }

  async findAll(): Promise<AuditRule[]> {
    const result = await this.pool.query('SELECT * FROM audit_rules ORDER BY name');
    return result.rows.map(rowToAuditRule);
  }

  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    rules: Record<string, unknown>;
    enabled: boolean;
  }>): Promise<AuditRule | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      params.push(updates.description);
    }
    if (updates.rules !== undefined) {
      setClauses.push(`rules = $${idx++}`);
      params.push(JSON.stringify(updates.rules));
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${idx++}`);
      params.push(updates.enabled);
    }

    setClauses.push(`updated_at = now()`);
    params.push(id);

    const sql = `UPDATE audit_rules SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? rowToAuditRule(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM audit_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
