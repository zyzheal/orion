/**
 * CloudProviderService - Cloud provider account and resource management
 *
 * Provides cloud account registration, listing, resource queries,
 * and provider info with tenant isolation.
 * Uses PostgreSQL Repository pattern for persistence.
 */
import { v4 as uuidv4 } from 'uuid';
import { MultiCloudRepository, CloudAccountEntity, CloudResourceEntity } from '../../repositories/MultiCloudRepository';

export interface CloudAccountInput {
  name: string;
  provider: 'aws' | 'gcp' | 'azure' | 'alicloud' | 'private';
  region: string;
  credentials?: Record<string, string>;
  description?: string;
}

export interface CloudAccount {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  region: string;
  status: 'active' | 'inactive' | 'error';
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudResource {
  id: string;
  tenantId: string;
  accountId: string;
  provider: string;
  region: string;
  type: string;
  name: string;
  status: string;
  tags: Record<string, string>;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CloudProviderInfo {
  name: string;
  displayName: string;
  supportedRegions: string[];
  supportedResourceTypes: string[];
  apiEndpoint: string;
  documentationUrl: string;
}

export class CloudProviderService {
  private repo: MultiCloudRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repo = new MultiCloudRepository(db);
  }

  /**
   * Register a new cloud account for a tenant
   */
  async registerCloudAccount(tenantId: string, input: CloudAccountInput): Promise<CloudAccount> {
    const id = uuidv4();
    const now = new Date();

    const entity = await this.repo.createCloudAccount({
      tenant_id: tenantId,
      account_name: input.name,
      account_id: id,
      credential_type: input.provider,
      credential_ref: input.credentials ? JSON.stringify(input.credentials) : '',
      region: input.region,
      provider_id: input.provider,
      tags: input.description ? { description: input.description } : {},
    });

    return this.entityToAccount(entity);
  }

  /**
   * List all cloud accounts for a tenant
   */
  async listCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    const entities = await this.repo.findAccountsByTenant(tenantId);
    return entities.map(e => this.entityToAccount(e));
  }

  /**
   * List cloud resources for a tenant with optional filters
   */
  async listCloudResources(
    tenantId: string,
    filters?: { provider?: string; type?: string; region?: string; status?: string }
  ): Promise<CloudResource[]> {
    const entities = await this.repo.findResourcesByTenant(tenantId);

    let resources = entities.map(e => this.entityToResource(e));

    if (!filters) {
      return resources;
    }

    return resources.filter((r) => {
      if (filters.provider && r.provider !== filters.provider) return false;
      if (filters.type && r.type !== filters.type) return false;
      if (filters.region && r.region !== filters.region) return false;
      if (filters.status && r.status !== filters.status) return false;
      return true;
    });
  }

  /**
   * Get information about a cloud provider
   */
  getCloudProviderInfo(provider: string): CloudProviderInfo | null {
    const providerInfo: Record<string, CloudProviderInfo> = {
      aws: {
        name: 'aws',
        displayName: 'Amazon Web Services',
        supportedRegions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1', 'ap-southeast-1', 'cn-north-1'],
        supportedResourceTypes: ['ec2', 's3', 'rds', 'lambda', 'ecs', 'eks'],
        apiEndpoint: 'https://api.aws.amazon.com',
        documentationUrl: 'https://docs.aws.amazon.com',
      },
      gcp: {
        name: 'gcp',
        displayName: 'Google Cloud Platform',
        supportedRegions: ['us-central1', 'europe-west1', 'asia-east1', 'asia-northeast1'],
        supportedResourceTypes: ['compute_engine', 'cloud_storage', 'cloud_sql', 'cloud_functions', 'gke'],
        apiEndpoint: 'https://cloud.google.com/apis',
        documentationUrl: 'https://cloud.google.com/docs',
      },
      azure: {
        name: 'azure',
        displayName: 'Microsoft Azure',
        supportedRegions: ['eastus', 'westus2', 'westeurope', 'southeastasia', 'eastasia'],
        supportedResourceTypes: ['virtual_machine', 'blob_storage', 'sql_database', 'functions', 'aks'],
        apiEndpoint: 'https://management.azure.com',
        documentationUrl: 'https://docs.microsoft.com/azure',
      },
      alicloud: {
        name: 'alicloud',
        displayName: 'Alibaba Cloud',
        supportedRegions: ['cn-hangzhou', 'cn-beijing', 'cn-shanghai', 'cn-shenzhen', 'ap-southeast-1'],
        supportedResourceTypes: ['ecs', 'oss', 'rds', 'fc', 'ack'],
        apiEndpoint: 'https://ecs.aliyuncs.com',
        documentationUrl: 'https://help.aliyun.com',
      },
      private: {
        name: 'private',
        displayName: 'Private Cloud',
        supportedRegions: ['on-premise'],
        supportedResourceTypes: ['vm', 'storage', 'network', 'load_balancer'],
        apiEndpoint: 'https://private-cloud.local',
        documentationUrl: '',
      },
    };

    return providerInfo[provider.toLowerCase()] ?? null;
  }

  /**
   * Add a resource to the resource pool (simulated sync from provider)
   */
  async addResource(tenantId: string, accountId: string, resource: Omit<CloudResource, 'id' | 'tenantId' | 'accountId' | 'createdAt'>): Promise<CloudResource> {
    const entityId = uuidv4();
    const entity = await this.repo.createResource({
      tenant_id: tenantId,
      account_id: accountId,
      resource_type: resource.type,
      resource_id: entityId,
      resource_name: resource.name,
      region: resource.region,
      state: resource.status,
      spec: { ...resource.metadata, tags: resource.tags },
      tags: resource.tags,
    });

    return this.entityToResource(entity);
  }

  /**
   * Delete a cloud account
   */
  async deleteCloudAccount(accountId: string, tenantId: string): Promise<boolean> {
    // First check the account belongs to tenant
    const accounts = await this.repo.findAccountsByTenant(tenantId);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      return false;
    }

    // Remove associated resources
    await this.repo.deleteResourcesByAccount(account.account_id, tenantId);

    // Delete the account
    return this.repo.deleteCloudAccount(accountId, tenantId);
  }

  /**
   * Get account by ID
   */
  async getCloudAccount(accountId: string, tenantId: string): Promise<CloudAccount | null> {
    const entity = await this.repo.findAccountById(accountId);
    if (!entity || entity.tenant_id !== tenantId) {
      return null;
    }
    return this.entityToAccount(entity);
  }

  // ==================== Entity to Domain Mapping ====================

  private entityToAccount(entity: CloudAccountEntity): CloudAccount {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.account_name,
      provider: entity.credential_type,
      region: entity.region,
      status: (entity.status as CloudAccount['status']) ?? 'active',
      description: entity.tags?.description,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private entityToResource(entity: CloudResourceEntity): CloudResource {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      accountId: entity.account_id,
      provider: entity.resource_type,
      region: entity.region,
      type: entity.resource_type,
      name: entity.resource_name || '',
      status: entity.state,
      tags: entity.tags || {},
      metadata: entity.spec || {},
      createdAt: entity.discovered_at,
    };
  }
}

export default CloudProviderService;
