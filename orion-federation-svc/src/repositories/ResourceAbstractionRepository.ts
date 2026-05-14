/**
 * Resource Abstraction Repository - Stub Implementation
 *
 * In-memory stub for unified resource and deployment result repositories.
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
  private store = new Map<string, UnifiedResourceEntity>();

  constructor(_pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

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
    const now = new Date();
    const entity: UnifiedResourceEntity = {
      id: data.id ?? `ur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: data.tenant_id,
      name: data.name,
      resource_type: data.resource_type,
      provider: data.provider,
      region: data.region,
      status: data.status ?? 'provisioning',
      config: data.config || {},
      metadata: data.metadata || {},
      spec: data.spec || {},
      tags: data.tags || {},
      created_at: now,
      updated_at: now,
    };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findByTenant(tenantId: string): Promise<UnifiedResourceEntity[]> {
    return Array.from(this.store.values()).filter(r => r.tenant_id === tenantId);
  }

  async deleteResource(resourceId: string, _tenantId: string): Promise<boolean> {
    return this.store.delete(resourceId);
  }
}

export class DeploymentResultRepository {
  private store = new Map<string, DeploymentResultEntity>();

  constructor(_pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

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
    const now = new Date();
    const entity: DeploymentResultEntity = {
      id: data.id ?? `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: data.tenant_id,
      resource_id: data.resource_id ?? '',
      status: data.status ?? 'deploying',
      provider: data.provider,
      region: data.region ?? '',
      service_name: data.service_name ?? '',
      resources: data.resources ?? [],
      result: data.result || {},
      error_message: data.error_message ?? null,
      created_at: now,
      updated_at: now,
    };
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(deploymentId: string): Promise<DeploymentResultEntity | null> {
    return this.store.get(deploymentId) || null;
  }

  async findByTenant(tenantId: string): Promise<DeploymentResultEntity[]> {
    return Array.from(this.store.values()).filter(r => r.tenant_id === tenantId);
  }

  async updateStatus(deploymentId: string, status: string, resources?: string[], errorMessage?: string): Promise<boolean> {
    const entity = this.store.get(deploymentId);
    if (!entity) return false;
    entity.status = status;
    entity.updated_at = new Date();
    if (resources) entity.resources = resources;
    if (errorMessage !== undefined) entity.error_message = errorMessage;
    return true;
  }
}
