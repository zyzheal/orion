/**
 * 云资源成本采集器
 *
 * 通过适配器模式支持多云厂商（AWS/AliCloud/Tencent Cloud）的成本数据采集
 * 实现成本标准化，统一不同厂商的计费格式
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CloudResource,
  CloudProvider,
  CloudResourceType,
  ICloudCostAdapter,
  CostCollectionSchedule,
} from './types';

/**
 * AWS Cost Explorer 适配器（Mock 实现）
 */
export class AWSCostAdapter implements ICloudCostAdapter {
  provider: CloudProvider = 'aws';

  async collectCosts(startDate: Date, endDate: Date): Promise<CloudResource[]> {
    // Mock: 模拟 AWS Cost Explorer API 返回数据
    const now = new Date();
    return [
      {
        id: uuidv4(),
        provider: 'aws',
        resourceType: 'compute',
        resourceId: 'i-0abc123def456',
        resourceName: 'production-api-server',
        region: 'us-east-1',
        cost: 125.50,
        currency: 'USD',
        tags: {
          Environment: 'production',
          Team: 'platform',
          Tenant: 'tenant-001',
        },
        timestamp: now,
        tenantId: 'tenant-001',
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
      {
        id: uuidv4(),
        provider: 'aws',
        resourceType: 'storage',
        resourceId: 'vol-0abc789',
        resourceName: 'production-data-volume',
        region: 'us-east-1',
        cost: 45.00,
        currency: 'USD',
        tags: {
          Environment: 'production',
          Team: 'data',
        },
        timestamp: now,
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
      {
        id: uuidv4(),
        provider: 'aws',
        resourceType: 'network',
        resourceId: 'nat-0abc123',
        resourceName: 'nat-gateway-main',
        region: 'us-east-1',
        cost: 32.75,
        currency: 'USD',
        tags: {
          Environment: 'production',
        },
        timestamp: now,
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
    ];
  }

  async getStatus(): Promise<{ connected: boolean; lastSync?: Date }> {
    return { connected: true, lastSync: new Date() };
  }
}

/**
 * 阿里云 Billing API 适配器（Mock 实现）
 */
export class AliCloudCostAdapter implements ICloudCostAdapter {
  provider: CloudProvider = 'alicloud';

  async collectCosts(startDate: Date, endDate: Date): Promise<CloudResource[]> {
    // Mock: 模拟阿里云费用中心 API 返回数据
    const now = new Date();
    return [
      {
        id: uuidv4(),
        provider: 'alicloud',
        resourceType: 'compute',
        resourceId: 'i-uf6abc123def456',
        resourceName: 'production-web-server',
        region: 'cn-hangzhou',
        cost: 89.30,
        currency: 'CNY',
        tags: {
          Environment: 'production',
          Project: 'orion',
          Tenant: 'tenant-002',
        },
        timestamp: now,
        tenantId: 'tenant-002',
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
      {
        id: uuidv4(),
        provider: 'alicloud',
        resourceType: 'database',
        resourceId: 'rm-uf6abc789',
        resourceName: 'production-rds-mysql',
        region: 'cn-hangzhou',
        cost: 210.00,
        currency: 'CNY',
        tags: {
          Environment: 'production',
          Project: 'orion',
        },
        timestamp: now,
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
    ];
  }

  async getStatus(): Promise<{ connected: boolean; lastSync?: Date }> {
    return { connected: true, lastSync: new Date() };
  }
}

/**
 * 腾讯云 Billing API 适配器（Mock 实现）
 */
export class TencentCloudCostAdapter implements ICloudCostAdapter {
  provider: CloudProvider = 'tencent';

  async collectCosts(startDate: Date, endDate: Date): Promise<CloudResource[]> {
    // Mock: 模拟腾讯云费用中心 API 返回数据
    const now = new Date();
    return [
      {
        id: uuidv4(),
        provider: 'tencent',
        resourceType: 'compute',
        resourceId: 'ins-abc123def',
        resourceName: 'production-worker',
        region: 'ap-guangzhou',
        cost: 95.20,
        currency: 'CNY',
        tags: {
          Environment: 'production',
          Team: 'worker',
          Tenant: 'tenant-003',
        },
        timestamp: now,
        tenantId: 'tenant-003',
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
      {
        id: uuidv4(),
        provider: 'tencent',
        resourceType: 'storage',
        resourceId: 'cos-bucket-001',
        resourceName: 'production-object-storage',
        region: 'ap-guangzhou',
        cost: 28.50,
        currency: 'CNY',
        tags: {
          Environment: 'production',
          Team: 'storage',
        },
        timestamp: now,
        environment: 'production',
        billingPeriod: `${startDate.toISOString()}/${endDate.toISOString()}`,
      },
    ];
  }

  async getStatus(): Promise<{ connected: boolean; lastSync?: Date }> {
    return { connected: true, lastSync: new Date() };
  }
}

/**
 * 云成本采集器
 *
 * 管理多云适配器，统一采集和标准化成本数据
 */
export class CloudCostCollector {
  private adapters: Map<CloudProvider, ICloudCostAdapter> = new Map();
  private schedules: Map<CloudProvider, CostCollectionSchedule> = new Map();
  private collectedData: CloudResource[] = [];

  constructor() {
    // 注册默认适配器
    this.registerAdapter(new AWSCostAdapter());
    this.registerAdapter(new AliCloudCostAdapter());
    this.registerAdapter(new TencentCloudCostAdapter());
  }

  /**
   * 注册云厂商适配器
   */
  registerAdapter(adapter: ICloudCostAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  /**
   * 获取已注册的适配器
   */
  getAdapter(provider: CloudProvider): ICloudCostAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * 获取所有已注册的提供商
   */
  getRegisteredProviders(): CloudProvider[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 采集指定厂商的成本数据
   */
  async collectFromProvider(
    provider: CloudProvider,
    startDate: Date,
    endDate: Date
  ): Promise<CloudResource[]> {
    const adapter = this.getAdapter(provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${provider}`);
    }

    const resources = await adapter.collectCosts(startDate, endDate);
    this.collectedData.push(...resources);

    // 更新调度状态
    const schedule = this.schedules.get(provider);
    if (schedule) {
      schedule.lastCollectedAt = new Date();
      schedule.lastStatus = 'success';
    }

    return resources;
  }

  /**
   * 采集所有已注册厂商的成本数据
   */
  async collectAll(startDate: Date, endDate: Date): Promise<CloudResource[]> {
    const allResources: CloudResource[] = [];
    const providers = this.getRegisteredProviders();

    for (const provider of providers) {
      const schedule = this.schedules.get(provider);
      if (schedule && !schedule.enabled) {
        continue;
      }
      try {
        const resources = await this.collectFromProvider(provider, startDate, endDate);
        allResources.push(...resources);
      } catch (error) {
        console.error(`[CloudCostCollector] Failed to collect from ${provider}:`, error);
        const schedule = this.schedules.get(provider);
        if (schedule) {
          schedule.lastStatus = 'failed';
        }
      }
    }

    return allResources;
  }

  /**
   * 标准化成本数据 - 将不同厂商的数据统一格式
   */
  normalizeCost(resources: CloudResource[]): CloudResource[] {
    return resources.map((r) => ({
      ...r,
      cost: this.normalizeCurrency(r.cost, r.currency),
      currency: 'USD', // 统一使用 USD
    }));
  }

  /**
   * 货币转换（简化版，实际应使用汇率 API）
   */
  normalizeCurrency(amount: number, fromCurrency: string): number {
    // Mock 汇率
    const exchangeRates: Record<string, number> = {
      USD: 1,
      CNY: 0.14, // 1 CNY = 0.14 USD (简化汇率)
      EUR: 1.08,
      JPY: 0.0067,
    };

    const rate = exchangeRates[fromCurrency] || 1;
    return Math.round(amount * rate * 100) / 100;
  }

  /**
   * 按资源类型分组成本
   */
  groupByResourceType(resources: CloudResource[]): Record<CloudResourceType, number> {
    const grouped: Record<string, number> = {};

    for (const r of resources) {
      if (!grouped[r.resourceType]) {
        grouped[r.resourceType] = 0;
      }
      grouped[r.resourceType] += r.cost;
    }

    return grouped as Record<CloudResourceType, number>;
  }

  /**
   * 按租户分组成本
   */
  groupByTenant(resources: CloudResource[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const r of resources) {
      const tenantId = r.tenantId || 'unknown';
      if (!grouped[tenantId]) {
        grouped[tenantId] = 0;
      }
      grouped[tenantId] += r.cost;
    }

    return grouped;
  }

  /**
   * 设置采集调度配置
   */
  setSchedule(provider: CloudProvider, schedule: CostCollectionSchedule): void {
    this.schedules.set(provider, schedule);
  }

  /**
   * 获取调度配置
   */
  getSchedule(provider: CloudProvider): CostCollectionSchedule | undefined {
    return this.schedules.get(provider);
  }

  /**
   * 获取已采集的数据
   */
  getCollectedData(): CloudResource[] {
    return [...this.collectedData];
  }

  /**
   * 清空已采集的数据
   */
  clearCollectedData(): void {
    this.collectedData = [];
  }

  /**
   * 获取采集状态摘要
   */
  getStatusSummary(): Record<CloudProvider, { connected: boolean; lastSync?: Date }> {
    const summary: Record<string, { connected: boolean; lastSync?: Date }> = {};

    for (const [provider, adapter] of this.adapters) {
      summary[provider] = { connected: false };
      adapter.getStatus().then((status) => {
        summary[provider] = status;
      }).catch(() => {
        summary[provider] = { connected: false };
      });
    }

    return summary as Record<CloudProvider, { connected: boolean; lastSync?: Date }>;
  }
}
