/**
 * ResourceAbstractionLayer - Unified resource abstraction across cloud providers
 *
 * Provides resource mapping, unified view, and multi-provider deployment
 * with tenant isolation.
 * Uses PostgreSQL Repository pattern for persistence.
 */
import { v4 as uuidv4 } from 'uuid';
import { UnifiedResourceRepository, DeploymentResultRepository, UnifiedResourceEntity, DeploymentResultEntity } from '../../repositories/ResourceAbstractionRepository';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LResource-LAbstraction-LLayer');

export interface ProviderResource {
  id: string;
  provider: string;
  resourceType: string;
  name: string;
  rawResource: Record<string, any>;
}

export interface UnifiedResource {
  id: string;
  tenantId: string;
  type: 'compute' | 'storage' | 'network' | 'database' | 'container' | 'other';
  name: string;
  provider: string;
  region: string;
  status: 'running' | 'stopped' | 'pending' | 'error';
  spec: {
    cpu?: number;
    memoryMb?: number;
    storageGb?: number;
    networkBandwidthMbps?: number;
  };
  tags: Record<string, string>;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface DeploymentConfig {
  serviceName: string;
  image: string;
  replicas: number;
  resourceSpec: {
    cpu: number;
    memoryMb: number;
  };
  environment?: Record<string, string>;
  ports?: number[];
}

export interface DeploymentResult {
  id: string;
  tenantId: string;
  provider: string;
  serviceName: string;
  status: 'deploying' | 'active' | 'failed';
  resources: string[];
  createdAt: Date;
  errorMessage?: string;
}

/**
 * Mapping from provider-specific resource types to unified types
 */
const RESOURCE_TYPE_MAP: Record<string, Record<string, UnifiedResource['type']>> = {
  aws: {
    ec2: 'compute',
    lambda: 'compute',
    s3: 'storage',
    ebs: 'storage',
    rds: 'database',
    dynamodb: 'database',
    vpc: 'network',
    elb: 'network',
    ecs: 'container',
    eks: 'container',
  },
  gcp: {
    compute_engine: 'compute',
    cloud_functions: 'compute',
    cloud_storage: 'storage',
    persistent_disk: 'storage',
    cloud_sql: 'database',
    firestore: 'database',
    vpc: 'network',
    load_balancer: 'network',
    gke: 'container',
    cloud_run: 'container',
  },
  azure: {
    virtual_machine: 'compute',
    functions: 'compute',
    blob_storage: 'storage',
    disk: 'storage',
    sql_database: 'database',
    cosmos_db: 'database',
    virtual_network: 'network',
    load_balancer: 'network',
    aks: 'container',
    container_instances: 'container',
  },
  alicloud: {
    ecs: 'compute',
    fc: 'compute',
    oss: 'storage',
    disk: 'storage',
    rds: 'database',
    polar: 'database',
    vpc: 'network',
    slb: 'network',
    ack: 'container',
  },
};

export class ResourceAbstractionLayer {
  private resourceRepo: UnifiedResourceRepository;
  private deploymentRepo: DeploymentResultRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.resourceRepo = new UnifiedResourceRepository(db);
    this.deploymentRepo = new DeploymentResultRepository(db);
  }

  /**
   * Map a provider-specific resource to the unified resource model
   */
  mapResource(
    provider: string,
    resourceType: string,
    resource: Record<string, any>
  ): UnifiedResource | null {
    const unifiedType = this.resolveResourceType(provider, resourceType);
    if (!unifiedType) {
      return null;
    }

    const mapped: UnifiedResource = {
      id: resource.id ?? uuidv4(),
      tenantId: resource.tenantId ?? 'default',
      type: unifiedType,
      name: resource.name ?? `${provider}-${resourceType}-${Date.now()}`,
      provider,
      region: resource.region ?? 'unknown',
      status: this.mapStatus(resource.status ?? 'running'),
      spec: this.mapResourceSpec(provider, resourceType, resource),
      tags: resource.tags ?? {},
      metadata: {
        providerResourceId: resource.id ?? '',
        providerResourceType: resourceType,
        ...resource.metadata,
      },
      createdAt: new Date(),
    };

    return mapped;
  }

  /**
   * Get unified resource view for a tenant
   */
  async getUnifiedResourceView(tenantId: string): Promise<UnifiedResource[]> {
    const entities = await this.resourceRepo.findByTenant(tenantId);
    return entities.map(e => this.entityToResource(e));
  }

  /**
   * Deploy a service to a specific cloud provider
   */
  async deployToProvider(
    provider: string,
    tenantId: string,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const id = uuidv4();
    const entity = await this.deploymentRepo.createDeployment({
      id,
      tenant_id: tenantId,
      provider,
      service_name: config.serviceName,
      status: 'deploying',
      resources: [],
      error_message: null,
    });

    const result = this.entityToDeployment(entity);

    // Simulate deployment asynchronously
    this.executeDeploymentAsync(result, config).catch((error) => {
      logger.error(`[ResourceAbstractionLayer] Deployment failed for ${result.id}:`, error.message);
    });

    return result;
  }

  /**
   * Register a unified resource directly
   */
  async registerResource(tenantId: string, resource: Omit<UnifiedResource, 'id' | 'tenantId' | 'createdAt'>): Promise<UnifiedResource> {
    const id = uuidv4();
    const entity = await this.resourceRepo.createResource({
      id,
      tenant_id: tenantId,
      resource_type: resource.type,
      name: resource.name,
      provider: resource.provider,
      region: resource.region,
      status: resource.status,
      spec: resource.spec,
      tags: resource.tags,
      metadata: resource.metadata,
    });

    return this.entityToResource(entity);
  }

  /**
   * Get deployment by ID
   */
  async getDeployment(deploymentId: string, tenantId: string): Promise<DeploymentResult | null> {
    const entity = await this.deploymentRepo.findById(deploymentId);
    if (!entity || entity.tenant_id !== tenantId) {
      return null;
    }
    return this.entityToDeployment(entity);
  }

  /**
   * List deployments for a tenant
   */
  async listDeployments(tenantId: string): Promise<DeploymentResult[]> {
    const entities = await this.deploymentRepo.findByTenant(tenantId);
    return entities.map(e => this.entityToDeployment(e));
  }

  /**
   * Delete a resource
   */
  async deleteResource(resourceId: string, tenantId: string): Promise<boolean> {
    return this.resourceRepo.deleteResource(resourceId, tenantId);
  }

  // ==================== Internal methods ====================

  /**
   * Resolve provider-specific resource type to unified type
   */
  private resolveResourceType(provider: string, resourceType: string): UnifiedResource['type'] | null {
    const providerMap = RESOURCE_TYPE_MAP[provider.toLowerCase()];
    if (providerMap) {
      return providerMap[resourceType] ?? null;
    }
    // Default mapping for unknown providers
    const defaultMap: Record<string, UnifiedResource['type']> = {
      vm: 'compute',
      server: 'compute',
      instance: 'compute',
      storage: 'storage',
      bucket: 'storage',
      disk: 'storage',
      database: 'database',
      db: 'database',
      network: 'network',
      vpc: 'network',
      lb: 'network',
      container: 'container',
      cluster: 'container',
    };
    return defaultMap[resourceType] ?? 'other';
  }

  /**
   * Map provider-specific status to unified status
   */
  private mapStatus(status: string): UnifiedResource['status'] {
    const statusMap: Record<string, UnifiedResource['status']> = {
      running: 'running',
      active: 'running',
      available: 'running',
      stopped: 'stopped',
      terminated: 'stopped',
      pending: 'pending',
      creating: 'pending',
      starting: 'pending',
      error: 'error',
      failed: 'error',
    };
    return statusMap[status.toLowerCase()] ?? 'running';
  }

  /**
   * Map provider-specific resource specs to unified spec
   */
  private mapResourceSpec(
    provider: string,
    resourceType: string,
    resource: Record<string, any>
  ): UnifiedResource['spec'] {
    const spec: UnifiedResource['spec'] = {};

    // Try common field names for CPU
    spec.cpu = resource.cpu ?? resource.vcpu ?? resource.cores ?? resource.instanceCpu ?? undefined;

    // Try common field names for memory
    if (resource.memory) {
      spec.memoryMb = typeof resource.memory === 'number' ? resource.memory : undefined;
    } else if (resource.memoryMb) {
      spec.memoryMb = resource.memoryMb;
    } else if (resource.ram) {
      spec.memoryMb = resource.ram;
    }

    // Try common field names for storage
    if (resource.storage) {
      spec.storageGb = typeof resource.storage === 'number' ? resource.storage : undefined;
    } else if (resource.diskSize) {
      spec.storageGb = resource.diskSize;
    }

    // Try common field names for bandwidth
    spec.networkBandwidthMbps =
      resource.bandwidth ?? resource.networkBandwidth ?? resource.maxBandwidth ?? undefined;

    return spec;
  }

  /**
   * Execute deployment asynchronously (simulated)
   */
  private async executeDeploymentAsync(
    result: DeploymentResult,
    config: DeploymentConfig
  ): Promise<void> {
    try {
      // Simulate deployment steps
      const resourceId = uuidv4();
      const entity = await this.resourceRepo.createResource({
        id: resourceId,
        tenant_id: result.tenantId,
        resource_type: 'container',
        name: config.serviceName,
        provider: result.provider,
        region: 'auto',
        status: 'running',
        spec: {
          cpu: config.resourceSpec.cpu,
          memoryMb: config.resourceSpec.memoryMb,
        },
        tags: { service: config.serviceName },
        metadata: { image: config.image, replicas: config.replicas },
      });

      // Update deployment with created resource and active status
      await this.deploymentRepo.updateStatus(
        result.id,
        'active',
        [...result.resources, resourceId],
      );
    } catch (error: any) {
      await this.deploymentRepo.updateStatus(
        result.id,
        'failed',
        undefined,
        error.message,
      );
    }
  }

  // ==================== Entity to Domain Mapping ====================

  private entityToResource(entity: UnifiedResourceEntity): UnifiedResource {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      type: (entity.resource_type as UnifiedResource['type']) ?? 'other',
      name: entity.name,
      provider: entity.provider,
      region: entity.region,
      status: (entity.status as UnifiedResource['status']) ?? 'running',
      spec: entity.spec || {},
      tags: entity.tags || {},
      metadata: entity.metadata || {},
      createdAt: entity.created_at,
    };
  }

  private entityToDeployment(entity: DeploymentResultEntity): DeploymentResult {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      provider: entity.provider,
      serviceName: entity.service_name,
      status: (entity.status as DeploymentResult['status']) ?? 'deploying',
      resources: entity.resources || [],
      createdAt: entity.created_at,
      errorMessage: entity.error_message ?? undefined,
    };
  }
}

export default ResourceAbstractionLayer;
