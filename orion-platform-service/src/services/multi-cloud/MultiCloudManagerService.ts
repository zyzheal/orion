/**
 * Multi Cloud Manager Service - Phase 3
 *
 * Manage deployments across multiple cloud providers
 */

import { DatabasePool } from '../database';

export interface CloudProvider {
  id: string;
  tenant_id: string;
  name: string;
  type: 'aws' | 'gcp' | 'azure' | 'alicloud' | 'private';
  region: string;
  credentials_ref: string;
  status: 'active' | 'inactive' | 'error';
  created_at: Date;
}

export interface MultiCloudDeployment {
  id: string;
  tenant_id: string;
  deployment_id: string;
  providers: string[];
  strategy: 'primary-backup' | 'active-active' | 'failover';
  primary_provider: string;
  status: 'deploying' | 'active' | 'failed';
  created_at: Date;
}

export interface CloudAccount {
  id: string;
  tenant_id: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure' | 'alicloud' | 'private';
  region: string;
  status: 'active' | 'inactive' | 'error';
  credentials_ref: string;
  created_at: Date;
  metadata: Record<string, any>;
}

export interface ResourceInventory {
  id: string;
  account_id: string;
  provider: string;
  region: string;
  resource_type: 'vm' | 'storage' | 'network' | 'database' | 'container';
  instance_type: string;
  count: number;
  status: 'running' | 'stopped' | 'pending';
  cost_per_hour: number;
}

export interface CloudCostComparison {
  provider: string;
  region: string;
  vm_cost_monthly: number;
  storage_cost_monthly: number;
  network_cost_monthly: number;
  total_monthly: number;
  currency: string;
}

export class MultiCloudManagerService {
  private pool: DatabasePool;
  private cloudAccounts: Map<string, CloudAccount> = new Map();
  private resourceInventory: Map<string, ResourceInventory> = new Map();

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async registerProvider(input: { tenant_id: string; name: string; type: string; region: string; credentials_ref: string }): Promise<CloudProvider> {
    const result = await this.pool.query(
      `INSERT INTO cloud_providers
        (tenant_id, name, type, region, credentials_ref, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [input.tenant_id, input.name, input.type, input.region, input.credentials_ref]
    );
    return result.rows[0];
  }

  async listProviders(tenantId: string): Promise<CloudProvider[]> {
    const result = await this.pool.query(
      'SELECT * FROM cloud_providers WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows;
  }

  async deployMultiCloud(input: { tenant_id: string; deployment_id: string; strategy?: string }): Promise<MultiCloudDeployment> {
    const providers = await this.listProviders(input.tenant_id);
    const activeProviders = providers.filter(p => p.status === 'active');

    const result = await this.pool.query(
      `INSERT INTO multi_cloud_deployments
        (tenant_id, deployment_id, providers, strategy, primary_provider, status)
       VALUES ($1, $2, $3, $4, $5, 'deploying')
       RETURNING *`,
      [input.tenant_id, input.deployment_id, activeProviders.map(p => p.id), input.strategy || 'active-active', activeProviders[0]?.id]
    );
    return result.rows[0];
  }

  async failover(deploymentId: string, targetProviderId: string): Promise<{ success: boolean }> {
    // Update primary provider
    await this.pool.query(
      `UPDATE multi_cloud_deployments SET primary_provider = $2 WHERE id = $1`,
      [deploymentId, targetProviderId]
    );
    return { success: true };
  }

  // ==================== Cloud Account Management ====================

  async addCloudAccount(tenantId: string, input: {
    name: string;
    provider: string;
    region: string;
    credentials_ref: string;
    metadata?: Record<string, any>;
  }): Promise<CloudAccount> {
    const id = `cloud-acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account: CloudAccount = {
      id,
      tenant_id: tenantId,
      name: input.name,
      provider: input.provider as CloudAccount['provider'],
      region: input.region,
      status: 'active',
      credentials_ref: input.credentials_ref,
      created_at: new Date(),
      metadata: input.metadata || {},
    };
    this.cloudAccounts.set(id, account);

    // Seed mock resource inventory for this account
    this.seedResourceInventory(id, input.provider, input.region);

    return account;
  }

  async removeCloudAccount(accountId: string): Promise<boolean> {
    const existed = this.cloudAccounts.delete(accountId);
    // Also remove associated inventory
    for (const [key, inv] of this.resourceInventory.entries()) {
      if (inv.account_id === accountId) {
        this.resourceInventory.delete(key);
      }
    }
    return existed;
  }

  async listCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    return Array.from(this.cloudAccounts.values()).filter(a => a.tenant_id === tenantId);
  }

  async getCloudAccount(accountId: string): Promise<CloudAccount | null> {
    return this.cloudAccounts.get(accountId) || null;
  }

  // ==================== Resource Inventory ====================

  private seedResourceInventory(accountId: string, provider: string, region: string): void {
    const resources: ResourceInventory[] = [
      { id: `res-${accountId}-vm`, account_id: accountId, provider, region, resource_type: 'vm', instance_type: provider === 'aws' ? 't3.large' : provider === 'gcp' ? 'n2-standard-4' : 'ecs.s6.large', count: Math.floor(Math.random() * 10) + 2, status: 'running', cost_per_hour: 0.08 + Math.random() * 0.1 },
      { id: `res-${accountId}-storage`, account_id: accountId, provider, region, resource_type: 'storage', instance_type: provider === 'aws' ? 'gp3' : provider === 'gcp' ? 'pd-ssd' : 'cloud_essd', count: 5, status: 'running', cost_per_hour: 0.02 },
      { id: `res-${accountId}-network`, account_id: accountId, provider, region, resource_type: 'network', instance_type: 'load_balancer', count: 2, status: 'running', cost_per_hour: 0.025 },
      { id: `res-${accountId}-db`, account_id: accountId, provider, region, resource_type: 'database', instance_type: provider === 'aws' ? 'db.r6g.large' : provider === 'gcp' ? 'db-n1-standard-4' : 'mysql.x2.large.2c', count: 1, status: 'running', cost_per_hour: 0.35 },
      { id: `res-${accountId}-container`, account_id: accountId, provider, region, resource_type: 'container', instance_type: 'k8s_nodes', count: 3, status: 'running', cost_per_hour: 0.15 },
    ];
    resources.forEach(r => this.resourceInventory.set(r.id, r));
  }

  async getResourceInventory(tenantId: string, accountId?: string): Promise<ResourceInventory[]> {
    let items = Array.from(this.resourceInventory.values());
    if (accountId) {
      items = items.filter(i => i.account_id === accountId);
    }
    // Filter by tenant - only return inventory for accounts owned by tenant
    const tenantAccountIds = new Set(
      Array.from(this.cloudAccounts.values())
        .filter(a => a.tenant_id === tenantId)
        .map(a => a.id)
    );
    if (!accountId) {
      items = items.filter(i => tenantAccountIds.has(i.account_id));
    }
    return items;
  }

  async getResourceInventorySummary(tenantId: string): Promise<{
    total_resources: number;
    running_resources: number;
    stopped_resources: number;
    total_cost_per_hour: number;
    by_provider: Record<string, number>;
    by_type: Record<string, number>;
  }> {
    const inventory = await this.getResourceInventory(tenantId);
    const byProvider: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalCostPerHour = 0;

    for (const item of inventory) {
      byProvider[item.provider] = (byProvider[item.provider] || 0) + item.count;
      byType[item.resource_type] = (byType[item.resource_type] || 0) + item.count;
      totalCostPerHour += item.cost_per_hour * item.count;
    }

    return {
      total_resources: inventory.reduce((sum, i) => sum + i.count, 0),
      running_resources: inventory.filter(i => i.status === 'running').reduce((sum, i) => sum + i.count, 0),
      stopped_resources: inventory.filter(i => i.status === 'stopped').reduce((sum, i) => sum + i.count, 0),
      total_cost_per_hour: Math.round(totalCostPerHour * 100) / 100,
      by_provider: byProvider,
      by_type: byType,
    };
  }

  // ==================== Cloud Cost Comparison ====================

  async compareCloudCosts(tenantId: string, workload: {
    vm_count?: number;
    vm_type?: string;
    storage_gb?: number;
    bandwidth_gb_month?: number;
  }): Promise<CloudCostComparison[]> {
    const vmCount = workload.vm_count || 3;
    const storageGb = workload.storage_gb || 500;
    const bandwidth = workload.bandwidth_gb_month || 1000;

    const pricing = {
      aws: {
        'us-east-1': { vm_hourly: 0.096, storage_gb_monthly: 0.10, bandwidth_gb: 0.09 },
        'us-west-2': { vm_hourly: 0.096, storage_gb_monthly: 0.10, bandwidth_gb: 0.09 },
        'ap-northeast-1': { vm_hourly: 0.114, storage_gb_monthly: 0.11, bandwidth_gb: 0.12 },
      },
      gcp: {
        'us-central1': { vm_hourly: 0.084, storage_gb_monthly: 0.085, bandwidth_gb: 0.08 },
        'europe-west1': { vm_hourly: 0.092, storage_gb_monthly: 0.09, bandwidth_gb: 0.085 },
        'asia-east1': { vm_hourly: 0.102, storage_gb_monthly: 0.095, bandwidth_gb: 0.11 },
      },
      azure: {
        'eastus': { vm_hourly: 0.092, storage_gb_monthly: 0.09, bandwidth_gb: 0.087 },
        'westeurope': { vm_hourly: 0.098, storage_gb_monthly: 0.095, bandwidth_gb: 0.09 },
        'southeastasia': { vm_hourly: 0.108, storage_gb_monthly: 0.10, bandwidth_gb: 0.115 },
      },
      alicloud: {
        'cn-hangzhou': { vm_hourly: 0.072, storage_gb_monthly: 0.07, bandwidth_gb: 0.06 },
        'cn-shanghai': { vm_hourly: 0.072, storage_gb_monthly: 0.07, bandwidth_gb: 0.06 },
        'cn-beijing': { vm_hourly: 0.078, storage_gb_monthly: 0.075, bandwidth_gb: 0.065 },
      },
    };

    const hoursPerMonth = 730;
    const comparisons: CloudCostComparison[] = [];

    for (const [provider, regions] of Object.entries(pricing)) {
      for (const [region, prices] of Object.entries(regions)) {
        const vmCost = vmCount * prices.vm_hourly * hoursPerMonth;
        const storageCost = storageGb * prices.storage_gb_monthly;
        const networkCost = bandwidth * prices.bandwidth_gb;
        comparisons.push({
          provider,
          region,
          vm_cost_monthly: Math.round(vmCost * 100) / 100,
          storage_cost_monthly: Math.round(storageCost * 100) / 100,
          network_cost_monthly: Math.round(networkCost * 100) / 100,
          total_monthly: Math.round((vmCost + storageCost + networkCost) * 100) / 100,
          currency: 'USD',
        });
      }
    }

    comparisons.sort((a, b) => a.total_monthly - b.total_monthly);
    return comparisons;
  }
}