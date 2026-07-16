/**
 * CMDB Relation Repository - 配置项关联关系数据访问层
 */

import { DatabasePool } from '../../services/database';
import { CIRelation, CreateRelationInput } from '../../services/cmdb/CmdbTypes';

export class CmdbRelationRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建关联关系
   */
  async createRelation(input: CreateRelationInput, user: string, tenantId?: bigint): Promise<CIRelation> {
    const query = `
      INSERT INTO cmdb_ci_relation (
        from_ci_id, to_ci_id, relation_type, description, created_by, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at
    `;

    const params = [
      input.fromCiId,
      input.toCiId,
      input.relationType,
      input.description || null,
      user,
      tenantId?.toString() || '00000000-0000-0000-0000-000000000000',
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToRelation(result.rows[0]);
  }

  /**
   * 通过 ID 获取关联关系（含租户隔离）
   */
  async getRelationById(id: string, tenantId: bigint): Promise<CIRelation | null> {
    const query = `
      SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, deleted_at, tenant_id
      FROM cmdb_ci_relation
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id, tenantId.toString()]);
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
    relationType: string,
    tenantId?: bigint
  ): Promise<boolean> {
    const query = tenantId
      ? `SELECT 1 FROM cmdb_ci_relation
         WHERE from_ci_id = $1 AND to_ci_id = $2 AND relation_type = $3
         AND tenant_id = $4 AND deleted_at IS NULL`
      : `SELECT 1 FROM cmdb_ci_relation
         WHERE from_ci_id = $1 AND to_ci_id = $2 AND relation_type = $3 AND deleted_at IS NULL`;

    const result = await this.database.query(query, tenantId
      ? [fromCiId, toCiId, relationType, tenantId.toString()]
      : [fromCiId, toCiId, relationType]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 获取 CI 的关联关系
   */
  async getCIRelations(ciId: string, tenantId?: bigint): Promise<CIRelation[]> {
    const query = tenantId
      ? `SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, deleted_at, tenant_id
         FROM cmdb_ci_relation
         WHERE (from_ci_id = $1 OR to_ci_id = $1) AND tenant_id = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC`
      : `SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, deleted_at, tenant_id
         FROM cmdb_ci_relation
         WHERE (from_ci_id = $1 OR to_ci_id = $1) AND deleted_at IS NULL
         ORDER BY created_at DESC`;

    const result = await this.database.query(query, tenantId
      ? [ciId, tenantId.toString()]
      : [ciId]
    );
    return result.rows.map((row: any) => this.mapRowToRelation(row));
  }

  /**
   * 删除关联关系（软删除，含租户隔离）
   */
  async deleteRelation(id: string, tenantId: bigint): Promise<boolean> {
    const query = `
      UPDATE cmdb_ci_relation
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id, tenantId.toString()]);
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
