/**
 * EnvironmentRepository — PostgreSQL 数据访问层 (GAP-CN-02)
 *
 * 管理 pipeline_environments 表的 CRUD 操作，
 * 支持多环境（dev/staging/production）的配置管理。
 */

import { Pool } from 'pg';
import type { EnvironmentEntity } from '../models/Environment';

export { EnvironmentEntity } from '../models/Environment';

export interface EnvironmentCreateInput {
  id?: string;
  tenantId: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  variables?: Record<string, string>;
  approvalRequired?: boolean;
  approvalCount?: number;
}

/**
 * PostgreSQL EnvironmentRepository 实现
 */
export class PostgresEnvironmentRepository {
  constructor(private pool: Pool) {}

  /**
   * 创建环境记录
   */
  async create(input: EnvironmentCreateInput): Promise<EnvironmentEntity> {
    const id = input.id || crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO pipeline_environments (
        id, tenant_id, name, description, display_order,
        variables, approval_required, approval_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      input.tenantId,
      input.name,
      input.description ?? null,
      input.displayOrder ?? 0,
      JSON.stringify(input.variables ?? {}),
      input.approvalRequired ?? false,
      input.approvalCount ?? 1,
      now,
      now,
    ]);

    if (result.rows.length === 0) {
      throw new Error('INSERT into pipeline_environments returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按 ID 查找环境
   */
  async findById(id: string): Promise<EnvironmentEntity | undefined> {
    const query = 'SELECT * FROM pipeline_environments WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  /**
   * 按租户查找所有环境，按 display_order 排序
   */
  async findByTenant(tenantId: string): Promise<EnvironmentEntity[]> {
    const query = `
      SELECT * FROM pipeline_environments
      WHERE tenant_id = $1
      ORDER BY display_order ASC
    `;
    const result = await this.pool.query(query, [tenantId]);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 按租户和名称查找环境（唯一约束）
   */
  async findByTenantAndName(tenantId: string, name: string): Promise<EnvironmentEntity | undefined> {
    const query = `
      SELECT * FROM pipeline_environments
      WHERE tenant_id = $1 AND name = $2
    `;
    const result = await this.pool.query(query, [tenantId, name]);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  /**
   * 按 Run ID 查找环境（通过环境名称与 run 上下文关联）
   * 注意：此方法返回空数组，因为 pipeline_environments 表不直接关联 run_id
   */
  async findByRunId(_runId: string): Promise<EnvironmentEntity[]> {
    // pipeline_environments 表不直接与 run_id 关联
    // 如需关联查询，应通过 pipeline_runs 表的 environment_id 字段 JOIN
    return [];
  }

  /**
   * 更新环境记录
   */
  async update(id: string, input: Partial<EnvironmentEntity>): Promise<EnvironmentEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(input.description);
      paramIndex++;
    }
    if (input.displayOrder !== undefined) {
      fields.push(`display_order = $${paramIndex}`);
      values.push(input.displayOrder);
      paramIndex++;
    }
    if (input.variables !== undefined) {
      fields.push(`variables = $${paramIndex}`);
      values.push(JSON.stringify(input.variables));
      paramIndex++;
    }
    if (input.approvalRequired !== undefined) {
      fields.push(`approval_required = $${paramIndex}`);
      values.push(input.approvalRequired);
      paramIndex++;
    }
    if (input.approvalCount !== undefined) {
      fields.push(`approval_count = $${paramIndex}`);
      values.push(input.approvalCount);
      paramIndex++;
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) {
        throw new Error(`Environment '${id}' not found`);
      }
      return existing;
    }

    fields.push(`updated_at = $${paramIndex}`);
    values.push(new Date().toISOString());
    paramIndex++;

    values.push(id);

    const query = `
      UPDATE pipeline_environments
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`Environment '${id}' not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 删除环境记录
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM pipeline_environments WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 将数据库行映射为 EnvironmentEntity
   */
  private mapRowToEntity(row: any): EnvironmentEntity {
    let variables: Record<string, string> = {};
    try {
      variables = typeof row.variables === 'string'
        ? JSON.parse(row.variables)
        : (row.variables || {});
    } catch {
      variables = {};
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      displayOrder: row.display_order ?? 0,
      variables,
      approvalRequired: row.approval_required ?? false,
      approvalCount: row.approval_count ?? 1,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
    };
  }
}

// Backward-compatible export alias
export const EnvironmentRepository = PostgresEnvironmentRepository;
export type EnvironmentRepository = PostgresEnvironmentRepository;
