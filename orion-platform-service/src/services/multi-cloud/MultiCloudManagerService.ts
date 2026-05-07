/**
 * Multi Cloud Manager Service - Phase 3
 *
 * Manage deployments across multiple cloud providers
 */

import { MultiCloudRepository, CloudAccountEntity, CloudResourceEntity } from '../../repositories/MultiCloudRepository';
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

/**
 * Deterministic resource inventory templates per provider.
 * Replaces Math.random()-based seeding.
 */
const RESOURCE_TEMPLATES: Record<string, {
  vm: { instance_type: string; cost_per_hour: number };
  storage: { instance_type: string; cost_per_hour: number };
  network: { instance_type: string; cost_per_hour: number };
  database: { instance_type: string; cost_per_hour: number };
  container: { instance_type: string; cost_per_hour: number };
}> = {
  aws: {
    vm: { instance_type: 't3.large', cost_per_hour: 0.096 },
    storage: { instance_type: 'gp3', cost_per_hour: 0.02 },
    network: { instance_type: 'load_balancer', cost_per_hour: 0.025 },
    database: { instance_type: 'this.pool.r6g.large', cost_per_hour: 0.35 },
    container: { instance_type: 'k8s_nodes', cost_per_hour: 0.15 },
  },
  gcp: {
    vm: { instance_type: 'n2-standard-4', cost_per_hour: 0.084 },
    storage: { instance_type: 'pd-ssd', cost_per_hour: 0.02 },
    network: { instance_type: 'load_balancer', cost_per_hour: 0.025 },
    database: { instance_type: 'db-n1-standard-4', cost_per_hour: 0.32 },
    container: { instance_type: 'k8s_nodes', cost_per_hour: 0.14 },
  },
  azure: {
    vm: { instance_type: 'Standard_D4s_v3', cost_per_hour: 0.092 },
    storage: { instance_type: 'premium_ssd', cost_per_hour: 0.02 },
    network: { instance_type: 'load_balancer', cost_per_hour: 0.025 },
    database: { instance_type: 'Standard_DS3_v2', cost_per_hour: 0.34 },
    container: { instance_type: 'aks_nodes', cost_per_hour: 0.145 },
  },
  alicloud: {
    vm: { instance_type: 'ecs.s6.large', cost_per_hour: 0.072 },
    storage: { instance_type: 'cloud_essd', cost_per_hour: 0.018 },
    network: { instance_type: 'slb', cost_per_hour: 0.02 },
    database: { instance_type: 'mysql.x2.large.2c', cost_per_hour: 0.28 },
    container: { instance_type: 'ack_nodes', cost_per_hour: 0.12 },
  },
  private: {
    vm: { instance_type: 'bare_metal', cost_per_hour: 0.06 },
    storage: { instance_type: 'nfs', cost_per_hour: 0.01 },
    network: { instance_type: 'hardware_lb', cost_per_hour: 0.015 },
    database: { instance_type: 'self_hosted_mysql', cost_per_hour: 0.2 },
    container: { instance_type: 'onprem_k8s', cost_per_hour: 0.1 },
  },
};

export class MultiCloudManagerService {
  
  private repository: MultiCloudRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new MultiCloudRepository(this.pool);
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
    const accountId = `cloud-acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const accountEntity = await this.repository.createCloudAccount({
      tenant_id: tenantId,
      account_name: input.name,
      account_id: accountId,
      credential_type: 'access_key',
      credential_ref: input.credentials_ref,
      region: input.region,
      tags: input.metadata || {},
    });

    // Seed deterministic resource inventory for this account
    await this.seedResourceInventory(tenantId, accountEntity.id, input.provider, input.region);

    return this.mapEntityToCloudAccount(accountEntity, input);
  }

  async removeCloudAccount(accountId: string, tenantId: string): Promise<boolean> {
    const deleted = await this.repository.deleteCloudAccount(accountId, tenantId);
    if (deleted) {
      await this.repository.deleteResourcesByAccount(accountId, tenantId);
    }
    return deleted;
  }

  async listCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    const entities = await this.repository.findAccountsByTenant(tenantId);
    return entities.map(e => this.mapEntityToCloudAccount(e, e.tags));
  }

  async getCloudAccount(accountId: string): Promise<CloudAccount | null> {
    const entity = await this.repository.findAccountById(accountId);
    if (!entity) return null;
    return this.mapEntityToCloudAccount(entity, entity.tags);
  }

  // ==================== Resource Inventory ====================

  private async seedResourceInventory(
    tenantId: string,
    accountId: string,
    provider: string,
    region: string,
  ): Promise<void> {
    const templates = RESOURCE_TEMPLATES[provider] || RESOURCE_TEMPLATES.private;
    const resourceTypes: Array<{ key: keyof typeof templates; type: ResourceInventory['resource_type']; count: number }> = [
      { key: 'vm', type: 'vm', count: 5 },
      { key: 'storage', type: 'storage', count: 5 },
      { key: 'network', type: 'network', count: 2 },
      { key: 'database', type: 'database', count: 1 },
      { key: 'container', type: 'container', count: 3 },
    ];

    for (const rt of resourceTypes) {
      const tpl = templates[rt.key];
      await this.repository.createResource({
        tenant_id: tenantId,
        account_id: accountId,
        resource_type: rt.type,
        resource_id: `res-${accountId}-${rt.key}`,
        resource_name: `${provider}-${rt.type}`,
        region,
        state: 'running',
        spec: { instance_type: tpl.instance_type, count: rt.count },
        monthly_cost: Math.round(tpl.cost_per_hour * rt.count * 730 * 100) / 100,
        tags: { provider, resource_type: rt.type },
      });
    }
  }

  async getResourceInventory(tenantId: string, accountId?: string): Promise<ResourceInventory[]> {
    const resourceEntities = await this.repository.findResourcesByTenant(tenantId, accountId);

    return resourceEntities.map(r => {
      const provider = r.tags?.provider || 'unknown';
      const count = r.spec?.count || 1;
      const hoursPerMonth = 730;
      const costPerHour = r.monthly_cost > 0 ? Math.round((r.monthly_cost / hoursPerMonth / count) * 1000) / 1000 : 0;
      return {
        id: r.id,
        account_id: r.account_id,
        provider,
        region: r.region,
        resource_type: r.resource_type as ResourceInventory['resource_type'],
        instance_type: r.spec?.instance_type || 'unknown',
        count,
        status: r.state as ResourceInventory['status'],
        cost_per_hour: costPerHour,
      };
    });
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

  // ==================== Mappers ====================

  private mapEntityToCloudAccount(entity: CloudAccountEntity, metadata?: Record<string, any>): CloudAccount {
    return {
      id: entity.account_id,
      tenant_id: entity.tenant_id,
      name: entity.account_name,
      provider: 'aws',
      region: entity.region,
      status: entity.status as CloudAccount['status'],
      credentials_ref: entity.credential_ref,
      created_at: entity.created_at,
      metadata: metadata || entity.tags,
    };
  }
}