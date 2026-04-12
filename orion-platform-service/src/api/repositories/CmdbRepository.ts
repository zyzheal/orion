/**
 * CMDB Repository - 配置项数据访问层
 */

import { DatabasePool, QueryResult } from '../database';
import { CI, CreateCIInput, UpdateCIInput, CIFilters, CIListResponse, CiStatus, CiType } from './CmdbTypes';

export class CmdbRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建配置项
   */
  async createCI(input: CreateCIInput): Promise<CI> {
    const query = `
      INSERT INTO cmdb_ci (
        ci_id, tenant_id, ci_type, name, description, status,
        environment, tags, attributes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, ci_id, tenant_id, ci_type, name, description, status,
                environment, tags, attributes, version, created_by, created_at, updated_at
    `;

    const params = [
      input.ciId,
      input.tenantId.toString(),
      input.ciType,
      input.name,
      input.description || null,
      input.status || 'ACTIVE',
      input.environment || null,
      input.tags || [],
      JSON.stringify(input.attributes || {}),
      input.createdBy,
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToCI(result.rows[0]);
  }

  /**
   * 通过 ID 获取配置项
   */
  async getCIById(id: string): Promise<CI | null> {
    const query = `
      SELECT id, ci_id, tenant_id, ci_type, name, description, status,
             environment, tags, attributes, version, created_by, created_at, updated_at, deleted_at
      FROM cmdb_ci
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToCI(result.rows[0]);
  }

  /**
   * 通过 ciId 获取配置项
   */
  async getCIByCiId(ciId: string, tenantId: bigint): Promise<CI | null> {
    const query = `
      SELECT id, ci_id, tenant_id, ci_type, name, description, status,
             environment, tags, attributes, version, created_by, created_at, updated_at, deleted_at
      FROM cmdb_ci
      WHERE ci_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString()]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToCI(result.rows[0]);
  }

  /**
   * 更新配置项
   */
  async updateCI(id: string, input: UpdateCIInput, user: string): Promise<CI | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    if (input.environment !== undefined) {
      updates.push(`environment = $${paramIndex++}`);
      params.push(input.environment);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(input.tags);
    }
    if (input.attributes !== undefined) {
      updates.push(`attributes = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(input.attributes));
    }

    if (updates.length === 0) {
      return this.getCIById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`version = version + 1`);

    params.push(id);

    const query = `
      UPDATE cmdb_ci
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING id, ci_id, tenant_id, ci_type, name, description, status,
                environment, tags, attributes, version, created_by, created_at, updated_at
    `;

    const result = await this.database.query(query, params);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToCI(result.rows[0]);
  }

  /**
   * 删除配置项（软删除）
   */
  async deleteCI(id: string): Promise<boolean> {
    const query = `
      UPDATE cmdb_ci
      SET deleted_at = CURRENT_TIMESTAMP, status = 'DECOMMISSIONED'
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 查询配置项列表
   */
  async listCIs(filters: CIFilters): Promise<CIListResponse> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    // 租户过滤（必须）
    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    // 可选过滤
    if (filters.ciType) {
      whereClauses.push(`ci_type = $${paramIndex++}`);
      params.push(filters.ciType);
    }
    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.environment) {
      whereClauses.push(`environment = $${paramIndex++}`);
      params.push(filters.environment);
    }
    if (filters.tags && filters.tags.length > 0) {
      whereClauses.push(`tags && $${paramIndex++}`);
      params.push(filters.tags);
    }
    if (filters.search) {
      whereClauses.push(`(name ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`);
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = whereClauses.join(' AND ');
    const orderBy = filters.orderBy || 'created_at';
    const order = filters.order || 'DESC';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_ci WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // 获取数据
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT id, ci_id, tenant_id, ci_type, name, description, status,
             environment, tags, attributes, version, created_by, created_at, updated_at
      FROM cmdb_ci
      WHERE ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    const data = result.rows.map((row: any) => this.mapRowToCI(row));

    return { data, total, limit, offset };
  }

  /**
   * 检查 CI 是否存在
   */
  async ciExists(ciId: string, tenantId: bigint): Promise<boolean> {
    const query = `
      SELECT 1 FROM cmdb_ci
      WHERE ci_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString()]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 将数据库行映射为 CI 对象
   */
  private mapRowToCI(row: any): CI {
    return {
      id: row.id,
      ciId: row.ci_id,
      tenantId: BigInt(row.tenant_id),
      ciType: row.ci_type as CiType,
      name: row.name,
      description: row.description,
      status: row.status as CiStatus,
      environment: row.environment,
      tags: row.tags || [],
      attributes: row.attributes || {},
      version: row.version,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
