/**
 * MultiCloudManagerService - Multi-cloud account and resource management
 *
 * Provides operations for managing cloud accounts across AWS, Azure, GCP,
 * and associated resource inventory tracking.
 */

import pino from 'pino';
import {
  MultiCloudRepository,
  CloudAccountEntity,
  CloudResourceEntity,
} from '../../repositories/MultiCloudRepository';
import { DatabasePool } from '../database';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Input Interfaces ====================

export interface AddCloudAccountInput {
  name: string;
  provider: string;
  region: string;
  credentials_ref: string;
  metadata?: Record<string, any>;
}

export interface CloudAccountConfig {
  tenant_id: string;
  account_name: string;
  account_id?: string;
  provider_id?: string;
  credential_type: string;
  credential_ref: string;
  region: string;
  monthly_budget?: number;
  tags?: Record<string, any>;
  created_by?: string;
}

export interface CloudStats {
  totalAccounts: number;
  activeAccounts: number;
  totalResources: number;
  totalMonthlySpend: number;
  accountsByProvider: Record<string, number>;
  resourcesByType: Record<string, number>;
  resourcesByRegion: Record<string, number>;
  resourcesByStatus: Record<string, number>;
}

export interface ResourceSyncJob {
  id: string;
  tenantId: string;
  accountId: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  resourcesDiscovered: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
  errors: string[];
}

export interface MigrationPlan {
  id: string;
  tenantId: string;
  name: string;
  sourceProvider: string;
  sourceRegion: string;
  targetProvider: string;
  targetRegion: string;
  resources: string[];
  status: 'planned' | 'migrating' | 'completed' | 'failed';
  estimatedCost: number;
  estimatedDuration: number;
  createdAt: string;
}

export interface MigrationResult {
  planId: string;
  status: 'success' | 'partial' | 'failed';
  migratedResources: number;
  failedResources: number;
  duration: number;
  details: { resourceId: string; status: string; message?: string }[];
}

// ==================== MultiCloudManagerService ====================

export class MultiCloudManagerService {
  private repo: MultiCloudRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.setRepository(new MultiCloudRepository(db));
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(repo: MultiCloudRepository): void {
    this.repo = repo;
  }

  // ==================== Cloud Account Operations ====================

  /**
   * Add a new cloud provider account
   */
  async addCloudProvider(config: CloudAccountConfig): Promise<CloudAccountEntity> {
    if (!this.repo) {
      const mockId = this.generateId();
      return {
        id: mockId,
        tenant_id: config.tenant_id,
        provider_id: config.provider_id ?? null,
        account_name: config.account_name,
        account_id: config.account_id ?? `mock-${mockId}`,
        credential_type: config.credential_type,
        credential_ref: config.credential_ref,
        region: config.region,
        status: 'active',
        monthly_budget: config.monthly_budget ?? null,
        current_spend: 0,
        tags: config.tags ?? {},
        created_by: config.created_by ?? 'system',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    const entity = await this.repo.createCloudAccount({
      tenant_id: config.tenant_id,
      account_name: config.account_name,
      account_id: config.account_id ?? this.generateId(),
      credential_type: config.credential_type,
      credential_ref: config.credential_ref,
      region: config.region,
      provider_id: config.provider_id,
      monthly_budget: config.monthly_budget,
      tags: config.tags,
      created_by: config.created_by,
    });

    logger.info({ accountId: entity.id, provider: config.provider_id ?? config.credential_type }, '[MultiCloudManager] Cloud account added');
    return entity;
  }

  /**
   * Add cloud account (alias for addCloudProvider with simpler input)
   */
  async addCloudAccount(tenantId: string, input: AddCloudAccountInput): Promise<CloudAccountEntity> {
    const providerMap: Record<string, string> = {
      aws: 'aws',
      azure: 'azure',
      gcp: 'gcp',
      kubernetes: 'kubernetes',
    };

    const credentialTypeMap: Record<string, string> = {
      aws: 'iam-role',
      azure: 'service-principal',
      gcp: 'service-account',
      kubernetes: 'kubeconfig',
    };

    return this.addCloudProvider({
      tenant_id: tenantId,
      account_name: input.name,
      provider_id: providerMap[input.provider] || input.provider,
      credential_type: credentialTypeMap[input.provider] || 'unknown',
      credential_ref: input.credentials_ref,
      region: input.region,
      tags: input.metadata,
    });
  }

  /**
   * List cloud providers/accounts for a tenant
   */
  async listProviders(tenantId: string): Promise<CloudAccountEntity[]> {
    if (!this.repo) {
      return [];
    }

    return this.repo.findAccountsByTenant(tenantId);
  }

  /**
   * List cloud accounts (alias for listProviders)
   */
  async listCloudAccounts(tenantId: string): Promise<CloudAccountEntity[]> {
    return this.listProviders(tenantId);
  }

  /**
   * Get cloud provider by ID
   */
  async getProvider(id: string): Promise<CloudAccountEntity | null> {
    if (!this.repo) {
      return null;
    }

    const account = await this.repo.findAccountById(id);
    return (account === undefined ? null : account) as CloudAccountEntity | null;
  }

  /**
   * Remove cloud provider/account
   */
  async removeProvider(id: string, tenantId: string): Promise<boolean> {
    if (!this.repo) {
      return false;
    }

    // First delete associated resources
    await this.repo.deleteResourcesByAccount(id, tenantId);

    // Then delete the account
    const deleted = await this.repo.deleteCloudAccount(id, tenantId);
    if (deleted) {
      logger.info({ accountId: id }, '[MultiCloudManager] Cloud account removed');
    }
    return deleted;
  }

  /**
   * Remove cloud account (alias for removeProvider)
   */
  async removeCloudAccount(accountId: string, tenantId: string): Promise<boolean> {
    return this.removeProvider(accountId, tenantId);
  }

  // ==================== Resource Inventory ====================

  /**
   * Get resource inventory
   */
  async getResourceInventory(tenantId: string, accountId?: string): Promise<CloudResourceEntity[]> {
    if (!this.repo) {
      return [];
    }

    return this.repo.findResourcesByTenant(tenantId, accountId);
  }

  /**
   * Get resource inventory summary
   */
  async getResourceInventorySummary(tenantId: string): Promise<{
    totalResources: number;
    byAccount: Record<string, number>;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    totalCost: number;
  }> {
    if (!this.repo) {
      return {
        totalResources: 0,
        byAccount: {},
        byType: {},
        byRegion: {},
        totalCost: 0,
      };
    }

    const resources = await this.repo.findResourcesByTenant(tenantId);

    const byAccount: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    let totalCost = 0;

    for (const r of resources) {
      byAccount[r.account_id] = (byAccount[r.account_id] || 0) + 1;
      byType[r.resource_type] = (byType[r.resource_type] || 0) + 1;
      byRegion[r.region] = (byRegion[r.region] || 0) + 1;
      totalCost += r.monthly_cost;
    }

    return {
      totalResources: resources.length,
      byAccount,
      byType,
      byRegion,
      totalCost,
    };
  }

  // ==================== Cloud Cost Operations ====================

  /**
   * Get cloud statistics
   */
  async getCloudStats(tenantId?: string): Promise<CloudStats> {
    if (!this.repo) {
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        totalResources: 0,
        totalMonthlySpend: 0,
        accountsByProvider: {},
        resourcesByType: {},
        resourcesByRegion: {},
        resourcesByStatus: {},
      };
    }

    const accounts = tenantId ? await this.repo.findAccountsByTenant(tenantId) : [];
    const resources = tenantId ? await this.repo.findResourcesByTenant(tenantId) : [];

    const accountsByProvider: Record<string, number> = {};
    const resourcesByType: Record<string, number> = {};
    const resourcesByRegion: Record<string, number> = {};
    const resourcesByStatus: Record<string, number> = {};
    let totalSpend = 0;

    for (const account of accounts) {
      accountsByProvider[account.provider_id ?? 'unknown'] = (accountsByProvider[account.provider_id ?? 'unknown'] || 0) + 1;
      totalSpend += account.current_spend;
    }

    for (const resource of resources) {
      resourcesByType[resource.resource_type] = (resourcesByType[resource.resource_type] || 0) + 1;
      resourcesByRegion[resource.region] = (resourcesByRegion[resource.region] || 0) + 1;
      resourcesByStatus[resource.state] = (resourcesByStatus[resource.state] || 0) + 1;
      totalSpend += resource.monthly_cost;
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalResources: resources.length,
      totalMonthlySpend: totalSpend,
      accountsByProvider,
      resourcesByType,
      resourcesByRegion,
      resourcesByStatus,
    };
  }

  /**
   * Compare cloud costs across providers
   */
  async compareCloudCosts(tenantId: string, params: {
    vm_count?: number;
    vm_type?: string;
    storage_gb?: number;
    bandwidth_gb_month?: number;
  }): Promise<{
    provider: string;
    estimatedMonthlyCost: number;
    breakdown: Record<string, number>;
  }[]> {
    // Simple cost estimation based on provider
    const estimates: Record<string, (params: any) => number> = {
      aws: (p) => {
        const compute = (p.vm_count || 1) * 50 * (p.vm_type === 'large' ? 2 : 1);
        const storage = (p.storage_gb || 100) * 0.1;
        const bandwidth = (p.bandwidth_gb_month || 10) * 0.09;
        return compute + storage + bandwidth;
      },
      azure: (p) => {
        const compute = (p.vm_count || 1) * 45 * (p.vm_type === 'large' ? 2 : 1);
        const storage = (p.storage_gb || 100) * 0.09;
        const bandwidth = (p.bandwidth_gb_month || 10) * 0.087;
        return compute + storage + bandwidth;
      },
      gcp: (p) => {
        const compute = (p.vm_count || 1) * 42 * (p.vm_type === 'large' ? 2 : 1);
        const storage = (p.storage_gb || 100) * 0.08;
        const bandwidth = (p.bandwidth_gb_month || 10) * 0.085;
        return compute + storage + bandwidth;
      },
    };

    const results = Object.entries(estimates).map(([provider, calculate]) => {
      const cost = calculate(params);
      return {
        provider,
        estimatedMonthlyCost: Math.round(cost * 100) / 100,
        breakdown: {
          compute: Math.round(((params.vm_count || 1) * 45) * 100) / 100,
          storage: Math.round(((params.storage_gb || 100) * 0.09) * 100) / 100,
          bandwidth: Math.round(((params.bandwidth_gb_month || 10) * 0.09) * 100) / 100,
        },
      };
    });

    return results.sort((a, b) => a.estimatedMonthlyCost - b.estimatedMonthlyCost);
  }

  // ==================== Resource Sync Scheduling ====================

  /**
   * Trigger a resource sync for a cloud account
   */
  async syncResources(tenantId: string, accountId: string): Promise<ResourceSyncJob> {
    const account = await this.getProvider(accountId);
    if (!account || account.tenant_id !== tenantId) {
      throw new Error('Cloud account not found');
    }

    const jobId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: ResourceSyncJob = {
      id: jobId,
      tenantId,
      accountId,
      provider: account.provider_id ?? account.credential_type,
      status: 'running',
      startedAt: new Date().toISOString(),
      resourcesDiscovered: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      resourcesDeleted: 0,
      errors: [],
    };

    // Simulate sync process
    this.executeSyncAsync(job).catch((error) => {
      logger.error({ jobId, error: error.message }, '[MultiCloudManager] Sync job failed');
    });

    return job;
  }

  /**
   * Get resource statistics with detailed breakdown
   */
  async getResourceStatistics(tenantId: string): Promise<{
    totalResources: number;
    byProvider: Record<string, number>;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    byStatus: Record<string, number>;
    totalMonthlyCost: number;
  }> {
    if (!this.repo) {
      return {
        totalResources: 0,
        byProvider: {},
        byType: {},
        byRegion: {},
        byStatus: {},
        totalMonthlyCost: 0,
      };
    }

    const resources = await this.repo.findResourcesByTenant(tenantId);
    const accounts = await this.repo.findAccountsByTenant(tenantId);

    // Build account provider map
    const accountProviderMap: Record<string, string> = {};
    for (const account of accounts) {
      accountProviderMap[account.account_id] = account.provider_id ?? account.credential_type;
    }

    const byProvider: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalMonthlyCost = 0;

    for (const r of resources) {
      const provider = accountProviderMap[r.account_id] ?? 'unknown';
      byProvider[provider] = (byProvider[provider] || 0) + 1;
      byType[r.resource_type] = (byType[r.resource_type] || 0) + 1;
      byRegion[r.region] = (byRegion[r.region] || 0) + 1;
      byStatus[r.state] = (byStatus[r.state] || 0) + 1;
      totalMonthlyCost += r.monthly_cost;
    }

    return {
      totalResources: resources.length,
      byProvider,
      byType,
      byRegion,
      byStatus,
      totalMonthlyCost,
    };
  }

  // ==================== Cross-Cloud Migration ====================

  /**
   * Create a migration plan
   */
  async createMigrationPlan(
    tenantId: string,
    plan: Omit<MigrationPlan, 'id' | 'tenantId' | 'status' | 'createdAt'>,
  ): Promise<MigrationPlan> {
    const id = `migration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const migrationPlan: MigrationPlan = {
      id,
      tenantId,
      ...plan,
      status: 'planned',
      createdAt: new Date().toISOString(),
    };

    logger.info({ planId: id, tenantId, source: plan.sourceProvider, target: plan.targetProvider }, '[MultiCloudManager] Migration plan created');
    return migrationPlan;
  }

  /**
   * Execute a migration plan (simulated)
   */
  async executeMigration(planId: string, tenantId: string): Promise<MigrationResult> {
    const startTime = Date.now();

    // Simulate migration with random results
    const resourceCount = Math.floor(Math.random() * 10) + 1;
    const details: { resourceId: string; status: string; message?: string }[] = [];

    for (let i = 0; i < resourceCount; i++) {
      const success = Math.random() > 0.1;
      details.push({
        resourceId: `resource-${i + 1}`,
        status: success ? 'migrated' : 'failed',
        message: success ? undefined : 'Timeout during migration',
      });
    }

    const migratedResources = details.filter(d => d.status === 'migrated').length;
    const failedResources = details.filter(d => d.status === 'failed').length;

    const result: MigrationResult = {
      planId,
      status: failedResources === 0 ? 'success' : migratedResources > 0 ? 'partial' : 'failed',
      migratedResources,
      failedResources,
      duration: Date.now() - startTime,
      details,
    };

    logger.info({ planId, result: result.status, migrated: migratedResources, failed: failedResources }, '[MultiCloudManager] Migration completed');
    return result;
  }

  // ==================== Internal Helpers ====================

  private async executeSyncAsync(job: ResourceSyncJob): Promise<void> {
    try {
      // Simulate discovering resources
      await new Promise(resolve => setTimeout(resolve, 100));

      const discovered = Math.floor(Math.random() * 50) + 10;
      const created = Math.floor(discovered * 0.3);
      const updated = Math.floor(discovered * 0.5);

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.resourcesDiscovered = discovered;
      job.resourcesCreated = created;
      job.resourcesUpdated = updated;

      logger.info({ jobId: job.id, discovered, created, updated }, '[MultiCloudManager] Sync completed');
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.errors.push(error.message);
    }
  }

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `cloud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default MultiCloudManagerService;