/**
 * ApiGovernanceRepository - PostgreSQL Repository for API Governance
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

export interface GovernanceRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  ruleType: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiInventoryEntity {
  id: string;
  tenantId: string;
  apiData: Record<string, unknown>;
  registeredAt: Date;
}

export interface CreateGovernanceRuleInput {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  ruleType: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateGovernanceRuleInput {
  name?: string;
  description?: string;
  ruleType?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export class GovernanceRuleRepository extends BaseRepository<GovernanceRuleEntity> {
  constructor(db: DatabasePool) {
    super(db, 'governance_rules');
  }

  async findByTenant(tenantId: string): Promise<GovernanceRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM governance_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndEnabled(tenantId: string): Promise<GovernanceRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM governance_rules WHERE tenant_id = $1 AND enabled = true ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<GovernanceRuleEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM governance_rules WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async createRule(input: CreateGovernanceRuleInput): Promise<GovernanceRuleEntity> {
    const result = await this.db.query(
      `INSERT INTO governance_rules (id, tenant_id, name, description, rule_type, config, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.name,
        input.description || null,
        input.ruleType,
        JSON.stringify(input.config),
        input.enabled ?? true,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateRule(id: string, input: UpdateGovernanceRuleInput): Promise<GovernanceRuleEntity | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.ruleType !== undefined) {
      sets.push(`rule_type = $${paramIndex++}`);
      values.push(input.ruleType);
    }
    if (input.config !== undefined) {
      sets.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(input.config));
    }
    if (input.enabled !== undefined) {
      sets.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    values.push(id);
    const result = await this.db.query(
      `UPDATE governance_rules SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM governance_rules WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): GovernanceRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      ruleType: row.rule_type,
      config: row.config || {},
      enabled: row.enabled ?? true,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

export class ApiInventoryRepository extends BaseRepository<ApiInventoryEntity> {
  constructor(db: DatabasePool) {
    super(db, 'api_inventory');
  }

  async findByTenant(tenantId: string, limit: number = 100): Promise<ApiInventoryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM api_inventory WHERE tenant_id = $1 ORDER BY registered_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async registerApi(tenantId: string, apiData: Record<string, unknown>): Promise<ApiInventoryEntity> {
    const id = crypto.randomUUID();
    const result = await this.db.query(
      `INSERT INTO api_inventory (id, tenant_id, api_data) VALUES ($1, $2, $3) RETURNING *`,
      [id, tenantId, JSON.stringify(apiData)],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateApi(id: string, apiData: Record<string, unknown>): Promise<ApiInventoryEntity | null> {
    const result = await this.db.query(
      `UPDATE api_inventory SET api_data = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(apiData), id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteApi(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM api_inventory WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ApiInventoryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      apiData: row.api_data || {},
      registeredAt: row.registered_at ? new Date(row.registered_at) : new Date(),
    };
  }
}