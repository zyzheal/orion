/**
 * CloudProviderService - Cloud provider account and resource management
 *
 * Provides cloud account registration, listing, resource queries,
 * and provider info with tenant isolation.
 * Uses PostgreSQL Repository pattern for persistence.
 */
import { v4 as uuidv4 } from 'uuid';
import { MultiCloudRepository, CloudAccountEntity, CloudResourceEntity } from '../../repositories/MultiCloudRepository';
import { ProviderClientFactory } from './providers/ProviderClientFactory';

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
  credentials?: Record<string, string>;
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

export interface CredentialValidationResult {
  valid: boolean;
  provider: string;
  message: string;
  checkedAt: Date;
  details?: Record<string, any>;
}

export interface ProviderHealthStatus {
  provider: string;
  region: string;
  healthy: boolean;
  latencyMs: number;
  checkedAt: Date;
  details: Record<string, any>;
}

export interface CloudCostSummary {
  provider: string;
  month: string;
  totalCost: number;
  currency: string;
  breakdown: { service: string; cost: number }[];
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

    const resources = entities.map(e => this.entityToResource(e));

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

  // ==================== Credential Management ====================

  /**
   * Validate credentials for a cloud account
   */
  async validateCredentials(accountId: string, tenantId: string): Promise<CredentialValidationResult> {
    const account = await this.getCloudAccount(accountId, tenantId);
    if (!account) {
      return { valid: false, provider: 'unknown', message: 'Account not found', checkedAt: new Date() };
    }

    try {
      const client = ProviderClientFactory.getClient(account.provider);
      const credentialRef = account.credentials ?? {};
      await client.initialize(credentialRef, account.region);
      const result = await client.validateCredentials();
      return {
        valid: result.valid,
        provider: account.provider,
        message: result.message,
        checkedAt: new Date(),
        details: result.details,
      };
    } catch (error: any) {
      return {
        valid: false,
        provider: account.provider,
        message: `Validation error: ${error.message}`,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check health of a cloud provider in a specific region
   */
  async checkProviderHealth(provider: string, region: string): Promise<ProviderHealthStatus> {
    const info = this.getCloudProviderInfo(provider);
    const supported = info ? info.supportedRegions.includes(region) : false;

    try {
      const client = ProviderClientFactory.getClient(provider);
      await client.initialize({}, region);
      const result = await client.checkHealth();
      return {
        provider,
        region,
        healthy: result.healthy && supported,
        latencyMs: result.latencyMs,
        checkedAt: new Date(),
        details: {
          apiEndpoint: info?.apiEndpoint ?? 'unknown',
          supportedRegions: info?.supportedRegions ?? [],
          regionSupported: supported,
          ...result.details,
        },
      };
    } catch (error: any) {
      return {
        provider,
        region,
        healthy: false,
        latencyMs: 0,
        checkedAt: new Date(),
        details: {
          apiEndpoint: info?.apiEndpoint ?? 'unknown',
          regionSupported: supported,
          error: error.message,
        },
      };
    }
  }

  /**
   * Get cost summary for a cloud account (simulated)
   */
  async getCostSummary(accountId: string, tenantId: string, month?: string): Promise<CloudCostSummary | null> {
    const account = await this.getCloudAccount(accountId, tenantId);
    if (!account) return null;

    const currentMonth = month ?? new Date().toISOString().slice(0, 7);

    // Simulated cost data per provider
    const costData: Record<string, { totalCost: number; breakdown: { service: string; cost: number }[] }> = {
      aws: {
        totalCost: 4250.75,
        breakdown: [
          { service: 'EC2', cost: 1800.00 },
          { service: 'S3', cost: 450.25 },
          { service: 'RDS', cost: 1200.50 },
          { service: 'Lambda', cost: 350.00 },
          { service: 'CloudFront', cost: 450.00 },
        ],
      },
      azure: {
        totalCost: 3100.50,
        breakdown: [
          { service: 'Virtual Machines', cost: 1400.00 },
          { service: 'Blob Storage', cost: 300.50 },
          { service: 'SQL Database', cost: 900.00 },
          { service: 'Functions', cost: 250.00 },
          { service: 'CDN', cost: 250.00 },
        ],
      },
      gcp: {
        totalCost: 2800.25,
        breakdown: [
          { service: 'Compute Engine', cost: 1200.00 },
          { service: 'Cloud Storage', cost: 250.25 },
          { service: 'Cloud SQL', cost: 800.00 },
          { service: 'Cloud Functions', cost: 300.00 },
          { service: 'Pub/Sub', cost: 250.00 },
        ],
      },
      alicloud: {
        totalCost: 2200.00,
        breakdown: [
          { service: 'ECS', cost: 1000.00 },
          { service: 'OSS', cost: 200.00 },
          { service: 'RDS', cost: 600.00 },
          { service: 'FC', cost: 200.00 },
          { service: 'CDN', cost: 200.00 },
        ],
      },
    };

    const data = costData[account.provider] ?? { totalCost: 0, breakdown: [] };

    return {
      provider: account.provider,
      month: currentMonth,
      totalCost: data.totalCost,
      currency: 'USD',
      breakdown: data.breakdown,
    };
  }

  /**
   * Get all supported providers
   */
  listSupportedProviders(): CloudProviderInfo[] {
    return ['aws', 'gcp', 'azure', 'alicloud', 'private']
      .map(p => this.getCloudProviderInfo(p))
      .filter((p): p is CloudProviderInfo => p !== null);
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
      credentials: entity.credential_ref ? JSON.parse(entity.credential_ref) : undefined,
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
