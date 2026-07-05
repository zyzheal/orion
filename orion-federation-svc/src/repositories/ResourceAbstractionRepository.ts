/**
 * Resource Abstraction Repository - PostgreSQL Implementation
 *
 * Unified resource and deployment result repositories using PostgreSQL.
 * Used by ResourceAbstractionLayer.
 */

export interface UnifiedResourceEntity {
  id: string;
  tenant_id: string;
  name: string;
  resource_type: string;
  provider: string;
  region: string;
  status: string;
  spec?: Record<string, any>;
  config: Record<string, any>;
  metadata: Record<string, any>;
  tags?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export interface DeploymentResultEntity {
  id: string;
  tenant_id: string;
  resource_id: string;
  status: string;
  provider: string;
  region: string;
  service_name?: string;
  resources?: string[];
  result: Record<string, any>;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export class UnifiedResourceRepository {
  constructor(private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async createResource(data: {
    id?: string;
    tenant_id: string;
    name: string;
    resource_type: string;
    provider: string;
    region: string;
    status?: string;
    spec?: Record<string, any>;
    config?: Record<string, any>;
    metadata?: Record<string, any>;
    tags?: Record<string, any>;
  }): Promise<UnifiedResourceEntity> {
    const result = await this.pool.query(
      `INSERT INTO federation_unified_resources (id, tenant_id, name, resource_type, provider, region, status, spec, config, metadata, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.id || null,
        data.tenant_id,
        data.name,
        data.resource_type,
        data.provider,
        data.region,
        data.status || 'provisioning',
        JSON.stringify(data.spec || {}),
        JSON.stringify(data.config || {}),
        JSON.stringify(data.metadata || {}),
        JSON.stringify(data.tags || {}),
      ]
    );
    return this.mapResourceRow(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<UnifiedResourceEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM federation_unified_resources WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows.map(this.mapResourceRow);
  }

  async deleteResource(resourceId: string, _tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM federation_unified_resources WHERE id = $1',
      [resourceId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapResourceRow(row: Record<string, unknown>): UnifiedResourceEntity {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      resource_type: row.resource_type as string,
      provider: row.provider as string,
      region: row.region as string,
      status: row.status as string,
      spec: typeof row.spec === 'string' ? JSON.parse(row.spec) : (row.spec || {}),
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || {}),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }
}

export class DeploymentResultRepository {
  constructor(private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async createDeployment(data: {
    id?: string;
    tenant_id: string;
    resource_id?: string;
    provider: string;
    region?: string;
    service_name?: string;
    status?: string;
    resources?: string[];
    result?: Record<string, any>;
    error_message?: string | null;
  }): Promise<DeploymentResultEntity> {
    const result = await this.pool.query(
      `INSERT INTO federation_deployment_results (id, tenant_id, resource_id, status, provider, region, service_name, resources, result, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.id || null,
        data.tenant_id,
        data.resource_id || null,
        data.status || 'deploying',
        data.provider,
        data.region || null,
        data.service_name || null,
        JSON.stringify(data.resources || []),
        JSON.stringify(data.result || {}),
        data.error_message || null,
      ]
    );
    return this.mapDeploymentRow(result.rows[0]);
  }

  async findById(deploymentId: string): Promise<DeploymentResultEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM federation_deployment_results WHERE id = $1',
      [deploymentId]
    );
    return result.rows[0] ? this.mapDeploymentRow(result.rows[0]) : null;
  }

  async findByTenant(tenantId: string): Promise<DeploymentResultEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM federation_deployment_results WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows.map(this.mapDeploymentRow);
  }

  async updateStatus(deploymentId: string, status: string, resources?: string[], errorMessage?: string): Promise<boolean> {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [deploymentId, status];
    let paramIndex = 3;

    if (resources) {
      updates.push(`resources = $${paramIndex++}`);
      params.push(JSON.stringify(resources));
    }
    if (errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(errorMessage);
    }

    const result = await this.pool.query(
      `UPDATE federation_deployment_results SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapDeploymentRow(row: Record<string, unknown>): DeploymentResultEntity {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      resource_id: row.resource_id as string || '',
      status: row.status as string,
      provider: row.provider as string,
      region: row.region as string || '',
      service_name: row.service_name as string | undefined,
      resources: typeof row.resources === 'string' ? JSON.parse(row.resources) : (row.resources || []),
      result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result || {}),
      error_message: row.error_message as string | null,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }
}