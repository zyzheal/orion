/**
 * CMDB Relation Type Repository - 关系类型数据访问层
 */

import { DatabasePool } from '../../services/database';
import { RelationTypeDefinition, CreateRelationTypeInput, UpdateRelationTypeInput } from '../../services/cmdb/CmdbTypes';

export class CmdbRelationTypeRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建关系类型
   */
  async createRelationType(input: CreateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition> {
    const query = `
      INSERT INTO cmdb_relation_type (name, description, category, tenant_id, is_system)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, tenant_id, name, description, category, is_system, created_at, updated_at
    `;

    const params = [input.name, input.description || null, input.category, tenantId.toString()];

    const result = await this.database.query(query, params);
    return this.mapRowToRelationType(result.rows[0]);
  }

  /**
   * 通过 ID 获取关系类型
   */
  async getRelationTypeById(id: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    const query = `
      SELECT id, tenant_id, name, description, category, is_system, created_at, updated_at
      FROM cmdb_relation_type
      WHERE id = $1 AND tenant_id = $2
    `;

    const result = await this.database.query(query, [id, tenantId.toString()]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToRelationType(result.rows[0]);
  }

  /**
   * 通过名称获取关系类型
   */
  async getRelationTypeByName(name: string, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    const query = `
      SELECT id, tenant_id, name, description, category, is_system, created_at, updated_at
      FROM cmdb_relation_type
      WHERE name = $1 AND tenant_id = $2
    `;

    const result = await this.database.query(query, [name, tenantId.toString()]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToRelationType(result.rows[0]);
  }

  /**
   * 获取租户下的所有关系类型
   */
  async getRelationTypes(tenantId: bigint): Promise<RelationTypeDefinition[]> {
    const query = `
      SELECT id, tenant_id, name, description, category, is_system, created_at, updated_at
      FROM cmdb_relation_type
      WHERE tenant_id = $1
      ORDER BY category, name
    `;

    const result = await this.database.query(query, [tenantId.toString()]);
    return result.rows.map((row: any) => this.mapRowToRelationType(row));
  }

  /**
   * 更新关系类型
   */
  async updateRelationType(id: string, input: UpdateRelationTypeInput, tenantId: bigint): Promise<RelationTypeDefinition | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(input.category);
    }

    if (updates.length === 0) {
      return this.getRelationTypeById(id, tenantId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(id, tenantId.toString());

    const query = `
      UPDATE cmdb_relation_type
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++}
      RETURNING id, tenant_id, name, description, category, is_system, created_at, updated_at
    `;

    const result = await this.database.query(query, params);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToRelationType(result.rows[0]);
  }

  /**
   * 删除关系类型
   */
  async deleteRelationType(id: string, tenantId: bigint): Promise<boolean> {
    const query = `
      DELETE FROM cmdb_relation_type
      WHERE id = $1 AND tenant_id = $2 AND is_system = false
    `;

    const result = await this.database.query(query, [id, tenantId.toString()]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 将数据库行映射为关系类型对象
   */
  private mapRowToRelationType(row: any): RelationTypeDefinition {
    return {
      tenantId: BigInt(row.tenant_id),
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      isSystem: row.is_system,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
