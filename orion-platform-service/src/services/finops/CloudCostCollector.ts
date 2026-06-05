/**
 * 云资源成本采集器
 *
 * 通过适配器模式支持多云厂商（AWS/AliCloud/Tencent Cloud）的成本数据采集
 * 实现成本标准化，统一不同厂商的计费格式
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { OrionError } from '../../errors';
import { CloudCostResourceRepository } from '../../repositories/CloudCostResourceRepository';
import { CloudCostScheduleRepository } from '../../repositories/CloudCostScheduleRepository';

const logger = pino({ name: 'LCloud-LCost-LCollector' });
import {
  CloudResource,
  CloudProvider,
  CloudResourceType,
  ICloudCostAdapter,
  CostCollectionSchedule,
} from './types';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

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
  /** 适配器注册表（运行时状态，保留内存） */
  private adapters: Map<CloudProvider, ICloudCostAdapter> = new Map();
  private resourceRepo: CloudCostResourceRepository;
  private scheduleRepo: CloudCostScheduleRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.resourceRepo = new CloudCostResourceRepository(db);
    this.scheduleRepo = new CloudCostScheduleRepository(db);

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
      throw new OrionError(`No adapter registered for provider: ${provider}`, 'OPERATION_FAILED')
    }

    const resources = await adapter.collectCosts(startDate, endDate);

    // 持久化采集到的资源数据
    for (const resource of resources) {
      await this.resourceRepo.create({
        id: resource.id,
        provider: resource.provider,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        resourceName: resource.resourceName || null,
        region: resource.region,
        cost: resource.cost,
        currency: resource.currency,
        tags: resource.tags,
        timestamp: resource.timestamp,
        environment: resource.environment || null,
        billingPeriod: resource.billingPeriod || null,
      });
    }

    // 更新调度状态
    await this.scheduleRepo.updateLastCollected(provider, 'success');

    return resources;
  }

  /**
   * 采集所有已注册厂商的成本数据
   */
  async collectAll(startDate: Date, endDate: Date): Promise<CloudResource[]> {
    const allResources: CloudResource[] = [];
    const providers = this.getRegisteredProviders();

    for (const provider of providers) {
      try {
        const schedule = await this.scheduleRepo.findByProvider(provider);
        if (schedule && !schedule.enabled) {
          continue;
        }

        const resources = await this.collectFromProvider(provider, startDate, endDate);
        allResources.push(...resources);
      } catch (error) {
        logger.error(`[CloudCostCollector] Failed to collect from ${provider}:`, error);
        try {
          await this.scheduleRepo.updateLastCollected(provider, 'failed');
        } catch (scheduleError) {
          logger.error(`[CloudCostCollector] Failed to update schedule status for ${provider}:`, scheduleError);
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
  async setSchedule(provider: CloudProvider, schedule: CostCollectionSchedule): Promise<void> {
    const existing = await this.scheduleRepo.findByProvider(provider);

    if (existing) {
      await this.scheduleRepo.update(existing.id, {
        cron_expression: schedule.cronExpression,
        enabled: schedule.enabled,
      });
    } else {
      await this.scheduleRepo.create({
        id: uuidv4(),
        provider,
        cronExpression: schedule.cronExpression,
        enabled: schedule.enabled,
      });
    }
  }

  /**
   * 获取调度配置
   */
  async getSchedule(provider: CloudProvider): Promise<CostCollectionSchedule | undefined> {
    const entity = await this.scheduleRepo.findByProvider(provider);
    if (!entity) return undefined;

    return {
      provider: entity.provider as CloudProvider,
      cronExpression: entity.cronExpression,
      enabled: entity.enabled,
      lastCollectedAt: entity.lastCollectedAt || undefined,
      lastStatus: (entity.lastStatus as 'success' | 'failed') || undefined,
    };
  }

  /**
   * 获取已采集的数据
   */
  async getCollectedData(): Promise<CloudResource[]> {
    const { entities } = await this.resourceRepo.findAll({ limit: 10000 });
    return entities.map((e) => ({
      id: e.id,
      provider: e.provider as CloudProvider,
      resourceType: e.resourceType as CloudResourceType,
      resourceId: e.resourceId,
      resourceName: e.resourceName || undefined,
      region: e.region,
      cost: e.cost,
      currency: e.currency,
      tags: e.tags,
      timestamp: e.timestamp,
      tenantId: e.tenantId || undefined,
      environment: e.environment || undefined,
      billingPeriod: e.billingPeriod || undefined,
    }));
  }

  /**
   * 清空已采集的数据
   */
  async clearCollectedData(): Promise<void> {
    const { entities } = await this.resourceRepo.findAll({ limit: 10000 });
    for (const entity of entities) {
      await this.resourceRepo.delete(entity.id);
    }
  }

  /**
   * 获取采集状态摘要
   */
  async getStatusSummary(): Promise<Record<CloudProvider, { connected: boolean; lastSync?: Date }>> {
    const summary: Record<string, { connected: boolean; lastSync?: Date }> = {};

    for (const [provider, adapter] of this.adapters) {
      try {
        const status = await adapter.getStatus();
        summary[provider] = status;
      } catch {
        summary[provider] = { connected: false };
      }
    }

    return summary as Record<CloudProvider, { connected: boolean; lastSync?: Date }>;
  }
}
