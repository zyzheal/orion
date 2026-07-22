/**
 * OCIRegistryRepository - Data access layer for OCI/Docker Registry configurations
 *
 * 负责管理 OCI/Docker Registry 连接配置的 CRUD 操作。
 * credentials 字段在 Service 层加密后在数据库中存储为 JSONB。
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';

export type RegistryType = 'docker' | 'harbor' | 'nexus' | 'ecr' | 'gcr' | 'acr' | 'quay';

export interface OCIRegistryEntity {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  registryType: RegistryType;
  credentials: Record<string, any>; // encrypted JSON
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OCIRegistryCreateInput {
  name: string;
  url: string;
  registryType: RegistryType;
  credentials: Record<string, any>; // plain text, will be encrypted by service
  isActive?: boolean;
}

export interface OCIRegistryUpdateInput {
  name?: string;
  url?: string;
  registryType?: RegistryType;
  credentials?: Record<string, any>; // plain text, will be encrypted by service
  isActive?: boolean;
}

export class OCIRegistryRepository extends BaseRepository<OCIRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'oci_registries');
  }

  /**
   * 根据名称查找 registry（tenant 隔离）
   */
  async findByName(name: string): Promise<OCIRegistryEntity | undefined> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND name = $2 LIMIT 1`,
      [tenantId, name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 根据 registry 类型查找（tenant 隔离）
   */
  async findByType(registryType: RegistryType): Promise<OCIRegistryEntity[]> {
    const tenantId = this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND registry_type = $2 ORDER BY created_at DESC`,
      [tenantId, registryType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 查找所有活跃的 registry（tenant 隔离）
   */
  async findActive(tenantId?: string): Promise<OCIRegistryEntity[]> {
    const tid = tenantId || this.getTenantId();
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC`,
      [tid],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 按名称检查是否存在（tenant 隔离）
   */
  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    let query = `SELECT 1 FROM ${this.tableName} WHERE tenant_id = $1 AND name = $2`;
    const params: unknown[] = [tenantId, name];

    if (excludeId) {
      query += ` AND id != $3`;
      params.push(excludeId);
    }

    query += ' LIMIT 1';
    const result = await this.db.query(query, params);
    return result.rows.length > 0;
  }

  protected mapRowToEntity(row: any): OCIRegistryEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      url: row.url,
      registryType: row.registry_type,
      credentials: row.credentials || {},
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
