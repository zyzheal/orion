/**
 * SecretRepository - 数据访问层
 *
 * 负责 secrets 表的 CRUD 操作。
 * encrypted_value 以 Buffer 形式存储（PostgreSQL BYTEA），
 * 加密/解密逻辑在 SecretsService 层处理。
 */

import { BaseRepository } from '../db/base-repository';

export type SecretScope = 'org' | 'project' | 'environment';

export interface SecretEntity {
  id: string;
  tenantId: string;
  name: string;
  encryptedValue: Buffer;
  scope: SecretScope;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface SecretCreateInput {
  id?: string;
  tenantId: string;
  name: string;
  encryptedValue: Buffer;
  scope?: SecretScope;
  createdBy?: string;
}

export class SecretRepository extends BaseRepository<SecretEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'secrets');
  }

  /**
   * 根据 tenant + name + scope 查找 secret
   */
  async findByTenantAndName(tenantId: string, name: string, scope?: SecretScope): Promise<SecretEntity | undefined> {
    if (scope) {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND name = $2 AND scope = $3`,
        [tenantId, name, scope],
      );
      if (result.rows.length === 0) return undefined;
      return this.mapRowToEntity(result.rows[0]);
    }

    // Without scope, search across all scopes (priority: project > environment > org)
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND name = $2 ORDER BY
        CASE scope WHEN 'project' THEN 1 WHEN 'environment' THEN 2 WHEN 'org' THEN 3 END
        LIMIT 1`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 列出某个 tenant + scope 下的所有 secrets
   */
  async listByTenantAndScope(tenantId: string, scope?: SecretScope): Promise<SecretEntity[]> {
    let query: string;
    let params: unknown[];

    if (scope) {
      query = `SELECT id, tenant_id, name, scope, created_at, updated_at, created_by FROM ${this.tableName} WHERE tenant_id = $1 AND scope = $2 ORDER BY name ASC`;
      params = [tenantId, scope];
    } else {
      query = `SELECT id, tenant_id, name, scope, created_at, updated_at, created_by FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY scope, name ASC`;
      params = [tenantId];
    }

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 创建 secret（带 ON CONFLICT 处理）
   */
  async upsert(data: SecretCreateInput): Promise<SecretEntity> {
    const scope = data.scope || 'project';
    const query = `
      INSERT INTO ${this.tableName} (id, tenant_id, name, encrypted_value, scope, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, name, scope)
      DO UPDATE SET encrypted_value = $4, updated_at = NOW()
      RETURNING *
    `;
    const result = await this.db.query(query, [
      data.id || this.generateId(),
      data.tenantId,
      data.name,
      data.encryptedValue,
      scope,
      data.createdBy || null,
    ]);
    if (result.rows.length === 0) {
      throw new Error(`UPSERT on ${this.tableName} returned no rows`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 按 tenant + scope 批量删除
   */
  async deleteByTenantAndScope(tenantId: string, scope: SecretScope): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1 AND scope = $2`,
      [tenantId, scope],
    );
    return result.rowCount ?? 0;
  }

  /**
   * 按 tenant 删除所有 secrets
   */
  async deleteByTenant(tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): SecretEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      encryptedValue: row.encrypted_value as Buffer,
      scope: row.scope as SecretScope,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }

  private generateId(): string {
    // Use crypto.randomUUID if available, fallback to simple id
    try {
      return require('crypto').randomUUID();
    } catch {
      return `secret-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  }
}
