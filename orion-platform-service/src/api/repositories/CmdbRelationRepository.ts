/**
 * CMDB Relation Repository - 配置项关联关系数据访问层
 */

import { DatabasePool } from '../database';
import { CIRelation, CreateRelationInput } from './CmdbTypes';

export class CmdbRelationRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建关联关系
   */
  async createRelation(input: CreateRelationInput, user: string): Promise<CIRelation> {
    const query = `
      INSERT INTO cmdb_ci_relation (
        from_ci_id, to_ci_id, relation_type, description, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at
    `;

    const params = [
      input.fromCiId,
      input.toCiId,
      input.relationType,
      input.description || null,
      user,
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToRelation(result.rows[0]);
  }

  /**
   * 通过 ID 获取关联关系
   */
  async getRelationById(id: string): Promise<CIRelation | null> {
    const query = `
      SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, deleted_at
      FROM cmdb_ci_relation
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToRelation(result.rows[0]);
  }

  /**
   * 检查关联关系是否存在
   */
  async relationExists(
    fromCiId: string,
    toCiId: string,
    relationType: string
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM cmdb_ci_relation
      WHERE from_ci_id = $1 AND to_ci_id = $2 AND relation_type = $3 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [fromCiId, toCiId, relationType]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 获取 CI 的关联关系
   */
  async getCIRelations(ciId: string): Promise<CIRelation[]> {
    const query = `
      SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, deleted_at
      FROM cmdb_ci_relation
      WHERE (from_ci_id = $1 OR to_ci_id = $1) AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const result = await this.database.query(query, [ciId]);
    return result.rows.map((row: any) => this.mapRowToRelation(row));
  }

  /**
   * 删除关联关系（软删除）
   */
  async deleteRelation(id: string): Promise<boolean> {
    const query = `
      UPDATE cmdb_ci_relation
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 将数据库行映射为 Relation 对象
   */
  private mapRowToRelation(row: any): CIRelation {
    return {
      id: row.id,
      fromCiId: row.from_ci_id,
      toCiId: row.to_ci_id,
      relationType: row.relation_type,
      description: row.description,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
