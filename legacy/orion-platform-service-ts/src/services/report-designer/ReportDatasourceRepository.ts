/**
 * ReportDatasourceRepository
 *
 * Repository for report_datasource table.
 * Uses migration 318 as authoritative schema.
 */

import { BaseRepository } from '../../db/base-repository';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { ValidationError, NotFoundError } from '../../errors';

export interface ReportDatasourceEntity {
  id: string;
  tenantId: string;
  name: string;
  datasourceType: string;
  config: Record<string, any>;
  refreshInterval: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ReportDatasourceRepository extends BaseRepository<ReportDatasourceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'report_datasource');
  }

  async list(): Promise<ReportDatasourceEntity[]> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_datasource WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getById(id: string): Promise<ReportDatasourceEntity | undefined> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `SELECT * FROM report_datasource WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(data: Omit<ReportDatasourceEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<ReportDatasourceEntity> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `INSERT INTO report_datasource (id, tenant_id, name, datasource_type, config, refresh_interval)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
       RETURNING *`,
      [
        tenantId,
        data.name,
        data.datasourceType,
        JSON.stringify(data.config),
        data.refreshInterval ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateById(id: string, data: Partial<Omit<ReportDatasourceEntity, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<ReportDatasourceEntity> {
    const tenantId = getCurrentTenantId();
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }
    if (data.datasourceType !== undefined) {
      setClauses.push(`datasource_type = $${paramIndex}`);
      params.push(data.datasourceType);
      paramIndex++;
    }
    if (data.config !== undefined) {
      setClauses.push(`config = $${paramIndex}`);
      params.push(JSON.stringify(data.config));
      paramIndex++;
    }
    if (data.refreshInterval !== undefined) {
      setClauses.push(`refresh_interval = $${paramIndex}`);
      params.push(data.refreshInterval);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No fields to update');
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const query = `
      UPDATE report_datasource
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Report datasource not found: ${id}`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteById(id: string): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    const result = await this.db.query(
      `DELETE FROM report_datasource WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const datasource = await this.getById(id);
    if (!datasource) {
      return { success: false, message: 'Datasource not found' };
    }

    // Validate that the config is present and has required fields
    if (!datasource.config || Object.keys(datasource.config).length === 0) {
      return { success: false, message: 'Datasource configuration is empty' };
    }

    // Basic validation based on datasource type
    const { datasourceType, config } = datasource;
    const requiredFields: Record<string, string[]> = {
      postgresql: ['host', 'port', 'database'],
      mysql: ['host', 'port', 'database'],
      api: ['url'],
      prometheus: ['url'],
      elasticsearch: ['url'],
    };

    const required = requiredFields[datasourceType] || [];
    const missing = required.filter(field => !config[field]);

    if (missing.length > 0) {
      return {
        success: false,
        message: `Missing required fields for ${datasourceType}: ${missing.join(', ')}`,
      };
    }

    return { success: true, message: 'Configuration is valid' };
  }

  protected mapRowToEntity(row: any): ReportDatasourceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      datasourceType: row.datasource_type,
      config: row.config ?? {},
      refreshInterval: row.refresh_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
