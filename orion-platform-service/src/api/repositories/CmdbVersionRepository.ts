/**
 * CMDB Version Repository - 配置项版本历史数据访问层
 */

import { DatabasePool } from '../../services/database';
import { CIVersion } from '../../services/cmdb/CmdbTypes';

export class CmdbVersionRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建版本记录
   */
  async createVersion(input: {
    ciId: string;
    version: number;
    changes: string;
    data: Record<string, any>;
    createdBy: string;
    tenantId?: bigint;
  }): Promise<CIVersion> {
    const query = `
      INSERT INTO cmdb_ci_version (
        ci_id, version, changes, data, created_by, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, ci_id, version, changes, data, created_by, created_at
    `;

    const params = [
      input.ciId,
      input.version,
      input.changes,
      JSON.stringify(input.data),
      input.createdBy,
      input.tenantId?.toString() || '00000000-0000-0000-0000-000000000000',
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToVersion(result.rows[0]);
  }

  /**
   * 获取 CI 的版本历史
   */
  async getVersions(ciId: string, tenantId?: bigint): Promise<CIVersion[]> {
    const query = tenantId
      ? `SELECT id, ci_id, version, changes, data, created_by, created_at, tenant_id
         FROM cmdb_ci_version
         WHERE ci_id = $1 AND tenant_id = $2
         ORDER BY version DESC`
      : `SELECT id, ci_id, version, changes, data, created_by, created_at, tenant_id
         FROM cmdb_ci_version
         WHERE ci_id = $1
         ORDER BY version DESC`;

    const result = await this.database.query(query, tenantId
      ? [ciId, tenantId.toString()]
      : [ciId]
    );
    return result.rows.map((row: any) => this.mapRowToVersion(row));
  }

  /**
   * 获取指定版本
   */
  async getVersion(ciId: string, version: number): Promise<CIVersion | null> {
    const query = `
      SELECT id, ci_id, version, changes, data, created_by, created_at, tenant_id
      FROM cmdb_ci_version
      WHERE ci_id = $1 AND version = $2
    `;

    const result = await this.database.query(query, [ciId, version]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToVersion(result.rows[0]);
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion(ciId: string, tenantId?: bigint): Promise<number> {
    const query = tenantId
      ? `SELECT MAX(version) as current_version
         FROM cmdb_ci_version
         WHERE ci_id = $1 AND tenant_id = $2`
      : `SELECT MAX(version) as current_version
         FROM cmdb_ci_version
         WHERE ci_id = $1`;

    const result = await this.database.query(query, tenantId
      ? [ciId, tenantId.toString()]
      : [ciId]
    );
    return result.rows[0]?.current_version || 0;
  }

  /**
   * 将数据库行映射为 Version 对象
   */
  private mapRowToVersion(row: any): CIVersion {
    return {
      id: row.id,
      ciId: row.ci_id,
      version: row.version,
      changes: row.changes,
      data: row.data,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }
}
