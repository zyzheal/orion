/**
 * CloudProviderService - Cloud provider account and resource management
 *
 * Provides cloud account registration, listing, resource queries,
 * and provider info with tenant isolation.
 * Uses in-memory Map storage (can migrate to Repository later).
 */
import { v4 as uuidv4 } from 'uuid';

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
  private accounts: Map<string, CloudAccount> = new Map();
  private resources: Map<string, CloudResource> = new Map();
  private accountsByTenant: Map<string, string[]> = new Map();

  /**
   * Register a new cloud account for a tenant
   */
  registerCloudAccount(tenantId: string, input: CloudAccountInput): CloudAccount {
    const id = uuidv4();
    const now = new Date();

    const account: CloudAccount = {
      id,
      tenantId,
      name: input.name,
      provider: input.provider,
      region: input.region,
      status: 'active',
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(id, account);

    // Index by tenant
    const tenantAccounts = this.accountsByTenant.get(tenantId) ?? [];
    tenantAccounts.push(id);
    this.accountsByTenant.set(tenantId, tenantAccounts);

    return account;
  }

  /**
   * List all cloud accounts for a tenant
   */
  listCloudAccounts(tenantId: string): CloudAccount[] {
    const accountIds = this.accountsByTenant.get(tenantId) ?? [];
    return accountIds
      .map((id) => this.accounts.get(id))
      .filter((a): a is CloudAccount => a !== undefined);
  }

  /**
   * List cloud resources for a tenant with optional filters
   */
  listCloudResources(
    tenantId: string,
    filters?: { provider?: string; type?: string; region?: string; status?: string }
  ): CloudResource[] {
    const allResources = Array.from(this.resources.values()).filter(
      (r) => r.tenantId === tenantId
    );

    if (!filters) {
      return allResources;
    }

    return allResources.filter((r) => {
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
  addResource(tenantId: string, accountId: string, resource: Omit<CloudResource, 'id' | 'tenantId' | 'accountId' | 'createdAt'>): CloudResource {
    const id = uuidv4();
    const fullResource: CloudResource = {
      id,
      tenantId,
      accountId,
      createdAt: new Date(),
      ...resource,
    };

    this.resources.set(id, fullResource);
    return fullResource;
  }

  /**
   * Delete a cloud account
   */
  deleteCloudAccount(accountId: string, tenantId: string): boolean {
    const account = this.accounts.get(accountId);
    if (!account || account.tenantId !== tenantId) {
      return false;
    }

    // Remove associated resources
    for (const [id, resource] of this.resources.entries()) {
      if (resource.accountId === accountId) {
        this.resources.delete(id);
      }
    }

    this.accounts.delete(accountId);

    // Update tenant index
    const tenantAccounts = this.accountsByTenant.get(tenantId) ?? [];
    const updated = tenantAccounts.filter((id) => id !== accountId);
    this.accountsByTenant.set(tenantId, updated);

    return true;
  }

  /**
   * Get account by ID
   */
  getCloudAccount(accountId: string, tenantId: string): CloudAccount | null {
    const account = this.accounts.get(accountId);
    if (!account || account.tenantId !== tenantId) {
      return null;
    }
    return account;
  }
}

export default CloudProviderService;
