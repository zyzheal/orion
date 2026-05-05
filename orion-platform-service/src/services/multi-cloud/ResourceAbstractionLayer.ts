/**
 * ResourceAbstractionLayer - Unified resource abstraction across cloud providers
 *
 * Provides resource mapping, unified view, and multi-provider deployment
 * with tenant isolation.
 * Uses in-memory Map storage (can migrate to Repository later).
 */
import { v4 as uuidv4 } from 'uuid';

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
  private resources: Map<string, UnifiedResource> = new Map();
  private deployments: Map<string, DeploymentResult> = new Map();
  private resourcesByTenant: Map<string, string[]> = new Map();
  private deploymentsByTenant: Map<string, string[]> = new Map();

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
  getUnifiedResourceView(tenantId: string): UnifiedResource[] {
    const resourceIds = this.resourcesByTenant.get(tenantId) ?? [];
    return resourceIds
      .map((id) => this.resources.get(id))
      .filter((r): r is UnifiedResource => r !== undefined);
  }

  /**
   * Deploy a service to a specific cloud provider
   */
  deployToProvider(
    provider: string,
    tenantId: string,
    config: DeploymentConfig
  ): DeploymentResult {
    const id = uuidv4();
    const result: DeploymentResult = {
      id,
      tenantId,
      provider,
      serviceName: config.serviceName,
      status: 'deploying',
      resources: [],
      createdAt: new Date(),
    };

    this.deployments.set(id, result);

    // Index by tenant
    const tenantDeployments = this.deploymentsByTenant.get(tenantId) ?? [];
    tenantDeployments.push(id);
    this.deploymentsByTenant.set(tenantId, tenantDeployments);

    // Simulate deployment
    this.executeDeploymentAsync(result, config);

    return result;
  }

  /**
   * Register a unified resource directly
   */
  registerResource(tenantId: string, resource: Omit<UnifiedResource, 'id' | 'tenantId' | 'createdAt'>): UnifiedResource {
    const id = uuidv4();
    const fullResource: UnifiedResource = {
      id,
      tenantId,
      createdAt: new Date(),
      ...resource,
    };

    this.resources.set(id, fullResource);

    // Index by tenant
    const tenantResources = this.resourcesByTenant.get(tenantId) ?? [];
    tenantResources.push(id);
    this.resourcesByTenant.set(tenantId, tenantResources);

    return fullResource;
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string, tenantId: string): DeploymentResult | null {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment || deployment.tenantId !== tenantId) {
      return null;
    }
    return deployment;
  }

  /**
   * List deployments for a tenant
   */
  listDeployments(tenantId: string): DeploymentResult[] {
    const deploymentIds = this.deploymentsByTenant.get(tenantId) ?? [];
    return deploymentIds
      .map((id) => this.deployments.get(id))
      .filter((d): d is DeploymentResult => d !== undefined);
  }

  /**
   * Delete a resource
   */
  deleteResource(resourceId: string, tenantId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource || resource.tenantId !== tenantId) {
      return false;
    }

    this.resources.delete(resourceId);

    const tenantResources = this.resourcesByTenant.get(tenantId) ?? [];
    this.resourcesByTenant.set(tenantId, tenantResources.filter((id) => id !== resourceId));

    return true;
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
      const unifiedResource: UnifiedResource = {
        id: resourceId,
        tenantId: result.tenantId,
        type: 'container',
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
        createdAt: new Date(),
      };

      this.resources.set(resourceId, unifiedResource);
      const tenantResources = this.resourcesByTenant.get(result.tenantId) ?? [];
      tenantResources.push(resourceId);
      this.resourcesByTenant.set(result.tenantId, tenantResources);

      result.resources.push(resourceId);
      result.status = 'active';
    } catch (error: any) {
      result.status = 'failed';
      result.errorMessage = error.message;
    }
  }
}

export default ResourceAbstractionLayer;
