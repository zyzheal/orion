/**
 * ResourceAbstractionRepository - Database layer for unified resources and deployments
 *
 * Provides PostgreSQL persistence for ResourceAbstractionLayer,
 * replacing the Map() in-memory storage.
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// ==================== Unified Resource ====================

export interface UnifiedResourceEntity {
  id: string;
  tenant_id: string;
  resource_type: string;
  name: string;
  provider: string;
  region: string;
  status: string;
  spec: Record<string, any>;
  tags: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export class UnifiedResourceRepository extends BaseRepository<UnifiedResourceEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'unified_resources');
  }

  async findByTenant(tenantId: string): Promise<UnifiedResourceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM unified_resources WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createResource(input: Omit<UnifiedResourceEntity, 'created_at' | 'updated_at'>): Promise<UnifiedResourceEntity> {
    const result = await this.db.query(
      `INSERT INTO unified_resources
        (id, tenant_id, resource_type, name, provider, region, status, spec, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.id,
        input.tenant_id,
        input.resource_type,
        input.name,
        input.provider,
        input.region,
        input.status,
        input.spec || {},
        input.tags || {},
        input.metadata || {},
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into unified_resources returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteResource(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM unified_resources WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): UnifiedResourceEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      resource_type: row.resource_type,
      name: row.name,
      provider: row.provider,
      region: row.region,
      status: row.status ?? 'running',
      spec: row.spec || {},
      tags: row.tags || {},
      metadata: row.metadata || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== Deployment Result ====================

export interface DeploymentResultEntity {
  id: string;
  tenant_id: string;
  provider: string;
  service_name: string;
  status: string;
  resources: string[];
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export class DeploymentResultRepository extends BaseRepository<DeploymentResultEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'deployment_results');
  }

  async findByTenant(tenantId: string): Promise<DeploymentResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deployment_results WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findById(id: string): Promise<DeploymentResultEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM deployment_results WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async createDeployment(input: Omit<DeploymentResultEntity, 'created_at' | 'updated_at'>): Promise<DeploymentResultEntity> {
    const result = await this.db.query(
      `INSERT INTO deployment_results
        (id, tenant_id, provider, service_name, status, resources, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.tenant_id,
        input.provider,
        input.service_name,
        input.status,
        input.resources || [],
        input.error_message,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT into deployment_results returned no rows');
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, resources?: string[], errorMessage?: string): Promise<DeploymentResultEntity | undefined> {
    const result = await this.db.query(
      `UPDATE deployment_results
       SET status = $2, resources = COALESCE($3, resources), error_message = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, resources ?? null, errorMessage ?? null],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): DeploymentResultEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      provider: row.provider,
      service_name: row.service_name,
      status: row.status ?? 'deploying',
      resources: row.resources || [],
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
