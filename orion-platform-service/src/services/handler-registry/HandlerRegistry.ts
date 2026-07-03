/**
 * HandlerRegistry - 三级存储 SPI 注册表
 *
 * L1: 内存 Map (运行时调用)
 * L2: PostgreSQL (持久化元数据)
 * L3: Redis Pub/Sub (多实例同步, 可选)
 */

import { HandlerRegistryRepository } from './HandlerRegistryRepository';
import {
  Handler,
  HandlerEntry,
  HandlerStatus,
  HealthStatus,
  RegisterHandlerInput,
  ListHandlersOptions,
  HealthCheckResult,
} from './types';
import { getCurrentTenantId } from '../../db/tenant-context-storage';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'handler-registry' });

export class HandlerRegistry {
  /** L1: Map<domain, Map<name, HandlerEntry>> */
  private handlers = new Map<string, Map<string, HandlerEntry>>();
  private repository: HandlerRegistryRepository;
  private redis: { publish?: (channel: string, message: string) => Promise<void>; subscribe?: (channel: string, callback: (message: string) => void) => void } | null;

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    redis?: { publish?: (channel: string, message: string) => Promise<void>; subscribe?: (channel: string, callback: (message: string) => void) => void },
  ) {
    this.repository = new HandlerRegistryRepository(db);
    this.redis = redis || null;
  }

  /**
   * 注册 Handler（代码级，启动时调用）
   */
  register(domain: string, name: string, handler: Handler, input: RegisterHandlerInput = {}): void {
    if (!this.handlers.has(domain)) {
      this.handlers.set(domain, new Map());
    }

    const entry: HandlerEntry = {
      handler,
      domain,
      name,
      displayName: input.displayName,
      description: input.description,
      version: input.version || '1.0.0',
      status: 'active',
      config: input.config || {},
      metadata: input.metadata || {},
      registeredAt: new Date(),
      registeredBy: input.registeredBy || 'code',
      invokeCount: 0,
      errorCount: 0,
      lastHealthStatus: 'unknown',
    };

    this.handlers.get(domain)!.set(name, entry);
    logger.info({ domain, name }, 'Handler registered');

    // 异步持久化元数据
    this.persistMetadata(domain, name, entry).catch((err) => {
      logger.error({ err, domain, name }, 'Failed to persist handler metadata');
    });

    // Redis 通知
    this.notifyPeers('register', domain, name).catch((err) => logger.warn({ err, domain, name }, 'Failed to notify peers of handler registration'));
  }

  /**
   * 注册元数据（API 级，无 Handler 实例）
   */
  async registerMetadata(domain: string, name: string, input: RegisterHandlerInput = {}): Promise<void> {
    const tenantId = getCurrentTenantId();
    const existing = await this.repository.findByDomainAndName(tenantId, domain, name);
    if (existing) {
      throw new Error(`Handler ${domain}/${name} already exists`);
    }

    await this.repository.create({
      tenant_id: tenantId,
      domain,
      name,
      display_name: input.displayName || null,
      description: input.description || null,
      version: input.version || '1.0.0',
      status: 'active',
      config: input.config || {},
      metadata: input.metadata || {},
      health_check: {},
      last_health_status: 'unknown',
      error_count: 0,
      registered_by: input.registeredBy || 'api',
    });

    logger.info({ domain, name, tenantId }, 'Handler metadata registered via API');
    await this.notifyPeers('register', domain, name);
  }

  /**
   * 解析 Handler（消费者调用）
   */
  resolve(domain: string, name: string): Handler | undefined {
    const domainMap = this.handlers.get(domain);
    if (!domainMap) return undefined;

    const entry = domainMap.get(name);
    if (!entry || entry.status !== 'active') return undefined;

    entry.lastInvokedAt = new Date();
    entry.invokeCount++;
    return entry.handler;
  }

  /**
   * 获取注册条目
   */
  getEntry(domain: string, name: string): HandlerEntry | undefined {
    return this.handlers.get(domain)?.get(name);
  }

  /**
   * 列出所有 Handler
   */
  async list(options: ListHandlersOptions = {}): Promise<HandlerEntry[]> {
    const results: HandlerEntry[] = [];

    for (const [domain, domainMap] of this.handlers) {
      if (options.domain && domain !== options.domain) continue;
      for (const [, entry] of domainMap) {
        if (options.status && entry.status !== options.status) continue;
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * 获取所有域名
   */
  getDomains(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 启用 Handler
   */
  async enable(domain: string, name: string): Promise<void> {
    const entry = this.handlers.get(domain)?.get(name);
    if (!entry) throw new Error(`Handler ${domain}/${name} not found`);

    entry.status = 'active';
    await this.updatePersistedStatus(domain, name, 'active');
    await this.notifyPeers('enable', domain, name);
    logger.info({ domain, name }, 'Handler enabled');
  }

  /**
   * 禁用 Handler
   */
  async disable(domain: string, name: string): Promise<void> {
    const entry = this.handlers.get(domain)?.get(name);
    if (!entry) throw new Error(`Handler ${domain}/${name} not found`);

    entry.status = 'disabled';
    await this.updatePersistedStatus(domain, name, 'disabled');
    await this.notifyPeers('disable', domain, name);
    logger.info({ domain, name }, 'Handler disabled');
  }

  /**
   * 注销 Handler
   */
  async unregister(domain: string, name: string): Promise<void> {
    const domainMap = this.handlers.get(domain);
    if (!domainMap?.has(name)) throw new Error(`Handler ${domain}/${name} not found`);

    domainMap.delete(name);
    if (domainMap.size === 0) this.handlers.delete(domain);

    // 删除持久化记录
    const tenantId = getCurrentTenantId();
    const entity = await this.repository.findByDomainAndName(tenantId, domain, name);
    if (entity) {
      await this.repository.delete(entity.id);
    }

    await this.notifyPeers('unregister', domain, name);
    logger.info({ domain, name }, 'Handler unregistered');
  }

  /**
   * 调用 Handler（测试用）
   */
  async invoke(domain: string, name: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const entry = this.handlers.get(domain)?.get(name);
    if (!entry) throw new Error(`Handler ${domain}/${name} not found`);
    if (entry.status !== 'active') throw new Error(`Handler ${domain}/${name} is ${entry.status}`);

    try {
      const result = await entry.handler.execute(payload);
      entry.lastInvokedAt = new Date();
      entry.invokeCount++;
      return result;
    } catch (error) {
      entry.errorCount++;
      entry.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const handlers: HealthCheckResult['handlers'] = [];
    let healthy = 0;
    let unhealthy = 0;
    let unknown = 0;

    for (const [domain, domainMap] of this.handlers) {
      for (const [name, entry] of domainMap) {
        let healthStatus: HealthStatus = 'unknown';

        if (entry.handler.healthCheck) {
          try {
            const result = await entry.handler.healthCheck();
            healthStatus = result.status;
          } catch {
            healthStatus = 'unhealthy';
          }
        }

        entry.lastHealthStatus = healthStatus;
        entry.lastHealthCheck = new Date();

        if (healthStatus === 'healthy') healthy++;
        else if (healthStatus === 'unhealthy') unhealthy++;
        else unknown++;

        handlers.push({
          domain,
          name,
          status: entry.status,
          healthStatus,
          lastHealthCheck: entry.lastHealthCheck?.toISOString(),
          lastError: entry.lastError,
          invokeCount: entry.invokeCount,
          errorCount: entry.errorCount,
        });
      }
    }

    return { total: handlers.length, healthy, unhealthy, unknown, handlers };
  }

  /**
   * 从数据库恢复注册元数据（启动时）
   */
  async restoreFromDatabase(tenantId: string): Promise<void> {
    try {
      const { entities } = await this.repository.findByTenant(tenantId);
      for (const entity of entities) {
        // 只恢复元数据，不恢复 Handler 实例（需要代码重新注册）
        if (!this.handlers.has(entity.domain)) {
          this.handlers.set(entity.domain, new Map());
        }
        const existing = this.handlers.get(entity.domain)!.get(entity.name);
        if (!existing) {
          // 创建占位条目，等待代码注册时填充 handler
          this.handlers.get(entity.domain)!.set(entity.name, {
            handler: { execute: async () => ({ restored: true }) },
            domain: entity.domain,
            name: entity.name,
            displayName: entity.displayName || undefined,
            description: entity.description || undefined,
            version: entity.version,
            status: entity.status,
            config: entity.config,
            metadata: entity.metadata,
            registeredAt: entity.createdAt,
            registeredBy: entity.registeredBy,
            invokeCount: 0,
            errorCount: entity.errorCount,
            lastHealthStatus: entity.lastHealthStatus,
            lastHealthCheck: entity.lastHealthCheck || undefined,
            lastError: entity.lastError || undefined,
          });
        }
      }
      logger.info({ tenantId, count: entities.length }, 'Handler metadata restored from database');
    } catch (error) {
      logger.error({ err: error, tenantId }, 'Failed to restore handler metadata from database');
    }
  }

  // ==================== Private Methods ====================

  private async persistMetadata(domain: string, name: string, entry: HandlerEntry): Promise<void> {
    const tenantId = getCurrentTenantId();
    const existing = await this.repository.findByDomainAndName(tenantId, domain, name);
    if (!existing) {
      await this.repository.create({
        tenant_id: tenantId,
        domain,
        name,
        display_name: entry.displayName || null,
        description: entry.description || null,
        version: entry.version,
        status: entry.status,
        config: entry.config,
        metadata: entry.metadata,
        health_check: {},
        last_health_status: entry.lastHealthStatus,
        error_count: entry.errorCount,
        registered_by: entry.registeredBy,
      });
    }
  }

  private async updatePersistedStatus(domain: string, name: string, status: HandlerStatus): Promise<void> {
    const tenantId = getCurrentTenantId();
    const entity = await this.repository.findByDomainAndName(tenantId, domain, name);
    if (entity) {
      await this.repository.updateStatus(entity.id, status);
    }
  }

  private async notifyPeers(action: string, domain: string, name: string): Promise<void> {
    if (!this.redis?.publish) return;
    try {
      const tenantId = getCurrentTenantId();
      const channel = `orion:handlers:notify:${tenantId}`;
      await this.redis.publish(channel, JSON.stringify({ action, domain, name, timestamp: Date.now() }));
    } catch (err) {
      logger.debug({ err }, 'Redis notification failed (non-critical)');
    }
  }
}
