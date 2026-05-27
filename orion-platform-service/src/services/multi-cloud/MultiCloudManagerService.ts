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
      };
    }

    const accounts = tenantId ? await this.repo.findAccountsByTenant(tenantId) : [];
    const resources = tenantId ? await this.repo.findResourcesByTenant(tenantId) : [];

    const accountsByProvider: Record<string, number> = {};
    const resourcesByType: Record<string, number> = {};
    let totalSpend = 0;

    for (const account of accounts) {
      accountsByProvider[account.provider_id ?? 'unknown'] = (accountsByProvider[account.provider_id ?? 'unknown'] || 0) + 1;
      totalSpend += account.current_spend;
    }

    for (const resource of resources) {
      resourcesByType[resource.resource_type] = (resourcesByType[resource.resource_type] || 0) + 1;
      totalSpend += resource.monthly_cost;
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status === 'active').length,
      totalResources: resources.length,
      totalMonthlySpend: totalSpend,
      accountsByProvider,
      resourcesByType,
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

  // ==================== Utility Methods ====================

  private generateId(): string {
    return `cloud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export default MultiCloudManagerService;