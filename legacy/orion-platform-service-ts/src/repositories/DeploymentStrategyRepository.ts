/**
 * DeploymentStrategyRepository — Data access for deployment strategy definitions
 *
 * GAP-CN-03: 渐进式发布策略存储
 */

import { DatabasePool } from '../services/database';

export interface DeploymentStrategyEntity {
  id: string;
  tenant_id: string;
  name: string;
  type: string; // 'canary' | 'bluegreen' | 'rolling'
  config: Record<string, any>;
  description: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class DeploymentStrategyRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Find strategy by ID
   */
  async findById(id: string): Promise<DeploymentStrategyEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_strategies WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all strategies for a tenant
   */
  async findByTenant(tenantId: string): Promise<DeploymentStrategyEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_strategies WHERE tenant_id = $1 ORDER BY name',
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Find strategy by name within tenant
   */
  async findByName(
    tenantId: string,
    name: string
  ): Promise<DeploymentStrategyEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_strategies WHERE tenant_id = $1 AND name = $2',
      [tenantId, name]
    );
    return result.rows[0] || null;
  }

  /**
   * Find strategies by type within tenant
   */
  async findByType(
    tenantId: string,
    type: string
  ): Promise<DeploymentStrategyEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM deployment_strategies WHERE tenant_id = $1 AND type = $2 ORDER BY name',
      [tenantId, type]
    );
    return result.rows;
  }

  /**
   * Create a new strategy
   */
  async create(
    input: Omit<DeploymentStrategyEntity, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DeploymentStrategyEntity> {
    const result = await this.pool.query(
      `INSERT INTO deployment_strategies (tenant_id, name, type, config, description, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.tenant_id,
        input.name,
        input.type,
        JSON.stringify(input.config),
        input.description || null,
        input.enabled ?? true,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a strategy
   */
  async update(
    id: string,
    updates: Partial<Omit<DeploymentStrategyEntity, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>>
  ): Promise<DeploymentStrategyEntity | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      params.push(updates.name);
      setClauses.push(`name = $${paramIndex++}`);
    }
    if (updates.type !== undefined) {
      params.push(updates.type);
      setClauses.push(`type = $${paramIndex++}`);
    }
    if (updates.config !== undefined) {
      params.push(JSON.stringify(updates.config));
      setClauses.push(`config = $${paramIndex++}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description);
      setClauses.push(`description = $${paramIndex++}`);
    }
    if (updates.enabled !== undefined) {
      params.push(updates.enabled);
      setClauses.push(`enabled = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const result = await this.pool.query(
      `UPDATE deployment_strategies SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a strategy
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM deployment_strategies WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
