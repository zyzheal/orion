/**
 * AI 降级配置 API 路由
 *
 * 提供 AI 降级策略管理功能：
 * - GET /api/v1/ai/degradation - 获取降级配置列表
 * - POST /api/v1/ai/degradation - 创建降级配置
 * - GET /api/v1/ai/degradation/:id - 获取降级配置详情
 * - PUT /api/v1/ai/degradation/:id - 更新降级配置
 * - DELETE /api/v1/ai/degradation/:id - 删除降级配置
 * - POST /api/v1/ai/degradation/:id/enable - 启用降级配置
 * - POST /api/v1/ai/degradation/:id/disable - 禁用降级配置
 * - GET /api/v1/ai/degradation/:id/history - 获取降级历史
 * - POST /api/v1/ai/degradation/:id/trigger - 手动触发降级
 * - POST /api/v1/ai/degradation/:id/recover - 恢复服务
 * - GET /api/v1/ai/degradation/status - 获取全局降级状态
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 降级策略类型枚举
 */
export enum DegradationStrategy {
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  QUEUE = 'queue',
  CACHE = 'cache',
  GRACEFUL = 'graceful',
  CUSTOM = 'custom',
}

/**
 * 降级触发条件枚举
 */
export enum TriggerCondition {
  ERROR_RATE = 'error_rate',
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  RESOURCE_USAGE = 'resource_usage',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
}

/**
 * 降级状态枚举
 */
export enum DegradationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIGGERED = 'triggered',
  RECOVERING = 'recovering',
}

/**
 * 服务状态枚举
 */
export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

/**
 * 降级配置
 */
export interface DegradationConfig {
  id: string;
  name: string;
  description: string;
  serviceName: string;
  strategy: DegradationStrategy;
  status: DegradationStatus;
  triggers: DegradationTrigger[];
  actions: DegradationAction[];
  recovery: RecoveryConfig;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  triggerCount: number;
}

/**
 * 降级触发器
 */
export interface DegradationTrigger {
  type: TriggerCondition;
  threshold: number;
  duration: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
}

/**
 * 降级动作
 */
export interface DegradationAction {
  type: 'response' | 'redirect' | 'queue' | 'cache' | 'custom';
  config: Record<string, unknown>;
  priority: number;
}

/**
 * 恢复配置
 */
export interface RecoveryConfig {
  autoRecover: boolean;
  recoveryTimeout: number;
  healthCheckInterval: number;
  healthCheckEndpoint?: string;
  minHealthyDuration: number;
}

/**
 * 降级历史记录
 */
export interface DegradationHistory {
  id: string;
  configId: string;
  triggeredAt: string;
  recoveredAt?: string;
  triggerType: TriggerCondition;
  triggerValue: number;
  triggerThreshold: number;
  duration: number;
  status: 'triggered' | 'recovered' | 'failed';
  actions: string[];
}

/**
 * 全局降级状态
 */
export interface GlobalDegradationStatus {
  services: {
    name: string;
    status: ServiceStatus;
    activeDegradations: number;
    lastIncident?: string;
  }[];
  activeConfigs: number;
  totalConfigs: number;
  recentTriggers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

/**
 * 创建降级配置请求
 */
export interface CreateDegradationConfigRequest {
  name: string;
  description: string;
  serviceName: string;
  strategy: DegradationStrategy;
  triggers: DegradationTrigger[];
  actions: DegradationAction[];
  recovery?: Partial<RecoveryConfig>;
  metadata?: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * 更新降级配置请求
 */
export interface UpdateDegradationConfigRequest {
  name?: string;
  description?: string;
  triggers?: DegradationTrigger[];
  actions?: DegradationAction[];
  recovery?: Partial<RecoveryConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * 触发降级请求
 */
export interface TriggerDegradationRequest {
  reason: string;
  duration?: number;
}

/**
 * AI 降级服务类
 */
export class AIDegradationService {
  private configs: Map<string, DegradationConfig> = new Map();
  private history: Map<string, DegradationHistory[]> = new Map();
  private configCounter = 0;
  private historyCounter = 0;

  /**
   * 生成配置 ID
   */
  private generateConfigId(): string {
    this.configCounter++;
    return `degrad_${Date.now()}_${this.configCounter}`;
  }

  /**
   * 生成历史 ID
   */
  private generateHistoryId(): string {
    this.historyCounter++;
    return `hist_${Date.now()}_${this.historyCounter}`;
  }

  /**
   * 创建降级配置
   */
  async createConfig(data: CreateDegradationConfigRequest): Promise<DegradationConfig> {
    const id = this.generateConfigId();
    const now = new Date().toISOString();

    const config: DegradationConfig = {
      id,
      name: data.name,
      description: data.description,
      serviceName: data.serviceName,
      strategy: data.strategy,
      status: DegradationStatus.INACTIVE,
      triggers: data.triggers,
      actions: data.actions,
      recovery: {
        autoRecover: data.recovery?.autoRecover ?? true,
        recoveryTimeout: data.recovery?.recoveryTimeout ?? 60000,
        healthCheckInterval: data.recovery?.healthCheckInterval ?? 10000,
        healthCheckEndpoint: data.recovery?.healthCheckEndpoint,
        minHealthyDuration: data.recovery?.minHealthyDuration ?? 30000,
      },
      metadata: data.metadata || {},
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
      triggerCount: 0,
    };

    this.configs.set(id, config);
    return config;
  }

  /**
   * 获取降级配置列表
   */
  async listConfigs(
    params: OffsetPaginationParams,
    filters?: {
      serviceName?: string;
      strategy?: DegradationStrategy;
      status?: DegradationStatus;
      enabled?: boolean;
    }
  ): Promise<{ data: DegradationConfig[]; total: number }> {
    let configs = Array.from(this.configs.values());

    if (filters?.serviceName) {
      configs = configs.filter(c => c.serviceName === filters.serviceName);
    }
    if (filters?.strategy) {
      configs = configs.filter(c => c.strategy === filters.strategy);
    }
    if (filters?.status) {
      configs = configs.filter(c => c.status === filters.status);
    }
    if (filters?.enabled !== undefined) {
      configs = configs.filter(c => c.enabled === filters.enabled);
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    configs.sort((a, b) => {
      const aVal = a[sortField as keyof DegradationConfig];
      const bVal = b[sortField as keyof DegradationConfig];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = configs.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    configs = configs.slice(offset, offset + limit);

    return { data: configs, total };
  }

  /**
   * 获取降级配置详情
   */
  async getConfig(id: string): Promise<DegradationConfig | null> {
    return this.configs.get(id) || null;
  }

  /**
   * 更新降级配置
   */
  async updateConfig(id: string, data: UpdateDegradationConfigRequest): Promise<DegradationConfig> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    const updated: DegradationConfig = {
      ...config,
      ...data,
      recovery: data.recovery ? { ...config.recovery, ...data.recovery } : config.recovery,
      updatedAt: new Date().toISOString(),
    };

    this.configs.set(id, updated);
    return updated;
  }

  /**
   * 删除降级配置
   */
  async deleteConfig(id: string): Promise<void> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    this.configs.delete(id);
    this.history.delete(id);
  }

  /**
   * 启用降级配置
   */
  async enableConfig(id: string): Promise<DegradationConfig> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    config.enabled = true;
    config.updatedAt = new Date().toISOString();
    this.configs.set(id, config);
    return config;
  }

  /**
   * 禁用降级配置
   */
  async disableConfig(id: string): Promise<DegradationConfig> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    config.enabled = false;
    config.status = DegradationStatus.INACTIVE;
    config.updatedAt = new Date().toISOString();
    this.configs.set(id, config);
    return config;
  }

  /**
   * 手动触发降级
   */
  async triggerDegradation(id: string, data: TriggerDegradationRequest): Promise<DegradationHistory> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    if (!config.enabled) {
      throw new Error('CONFIG_DISABLED', 'Degradation config is disabled');
    }

    const now = new Date().toISOString();
    config.status = DegradationStatus.TRIGGERED;
    config.lastTriggeredAt = now;
    config.triggerCount++;
    this.configs.set(id, config);

    const historyRecord: DegradationHistory = {
      id: this.generateHistoryId(),
      configId: id,
      triggeredAt: now,
      triggerType: TriggerCondition.MANUAL,
      triggerValue: 1,
      triggerThreshold: 0,
      duration: data.duration || config.recovery.recoveryTimeout,
      status: 'triggered',
      actions: config.actions.map(a => a.type),
    };

    const histories = this.history.get(id) || [];
    histories.unshift(historyRecord);
    this.history.set(id, histories);

    return historyRecord;
  }

  /**
   * 恢复服务
   */
  async recoverService(id: string): Promise<DegradationConfig> {
    const config = await this.getConfig(id);
    if (!config) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'degradation_config',
        identifier: id,
      });
    }

    const now = new Date().toISOString();
    config.status = DegradationStatus.INACTIVE;
    config.updatedAt = now;
    this.configs.set(id, config);

    // 更新历史记录
    const histories = this.history.get(id) || [];
    const latestHistory = histories.find(h => h.status === 'triggered');
    if (latestHistory) {
      latestHistory.status = 'recovered';
      latestHistory.recoveredAt = now;
    }

    return config;
  }

  /**
   * 获取降级历史
   */
  async getHistory(
    id: string,
    params: OffsetPaginationParams
  ): Promise<{ data: DegradationHistory[]; total: number }> {
    const histories = this.history.get(id) || [];
    const total = histories.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: histories.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取全局降级状态
   */
  async getGlobalStatus(): Promise<GlobalDegradationStatus> {
    const configs = Array.from(this.configs.values());
    const serviceMap = new Map<string, { active: number; lastIncident?: string }>();

    // 统计每个服务的状态
    for (const config of configs) {
      const existing = serviceMap.get(config.serviceName) || { active: 0 };
      if (config.status === DegradationStatus.TRIGGERED) {
        existing.active++;
        if (config.lastTriggeredAt) {
          if (!existing.lastIncident || config.lastTriggeredAt > existing.lastIncident) {
            existing.lastIncident = config.lastTriggeredAt;
          }
        }
      }
      serviceMap.set(config.serviceName, existing);
    }

    const services = Array.from(serviceMap.entries()).map(([name, data]) => ({
      name,
      status: data.active > 0 ? ServiceStatus.DEGRADED : ServiceStatus.HEALTHY,
      activeDegradations: data.active,
      lastIncident: data.lastIncident,
    }));

    const activeConfigs = configs.filter(c => c.status === DegradationStatus.TRIGGERED).length;
    const recentTriggers = configs.reduce((sum, c) => sum + c.triggerCount, 0);

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const degradedCount = services.filter(s => s.status === ServiceStatus.DEGRADED).length;
    if (degradedCount > 0) {
      systemHealth = degradedCount > services.length / 2 ? 'critical' : 'warning';
    }

    return {
      services,
      activeConfigs,
      totalConfigs: configs.length,
      recentTriggers,
      systemHealth,
    };
  }
}

// 单例服务实例
export const aiDegradationService = new AIDegradationService();

/**
 * AI 降级路由类
 */
export class AIDegradationRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/ai/degradation/status - 获取全局降级状态
    this.app.get('/api/v1/ai/degradation/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await aiDegradationService.getGlobalStatus();
      return reply.send(status);
    });

    // GET /api/v1/ai/degradation - 获取降级配置列表
    this.app.get('/api/v1/ai/degradation', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        serviceName?: string;
        strategy?: DegradationStrategy;
        status?: DegradationStatus;
        enabled?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await aiDegradationService.listConfigs(
        paginationParams,
        {
          serviceName: query.serviceName,
          strategy: query.strategy,
          status: query.status,
          enabled: query.enabled === 'true' ? true : query.enabled === 'false' ? false : undefined,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/ai/degradation - 创建降级配置
    this.app.post('/api/v1/ai/degradation', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateDegradationConfigRequest;
      const config = await aiDegradationService.createConfig(body);
      return reply.code(201).send(config);
    });

    // GET /api/v1/ai/degradation/:id - 获取降级配置详情
    this.app.get('/api/v1/ai/degradation/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const config = await aiDegradationService.getConfig(params.id);

      if (!config) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'degradation_config',
          identifier: params.id,
        });
      }

      return reply.send(config);
    });

    // PUT /api/v1/ai/degradation/:id - 更新降级配置
    this.app.put('/api/v1/ai/degradation/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdateDegradationConfigRequest;

      const config = await aiDegradationService.updateConfig(params.id, body);
      return reply.send(config);
    });

    // DELETE /api/v1/ai/degradation/:id - 删除降级配置
    this.app.delete('/api/v1/ai/degradation/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await aiDegradationService.deleteConfig(params.id);
      return reply.code(204).send();
    });

    // POST /api/v1/ai/degradation/:id/enable - 启用降级配置
    this.app.post('/api/v1/ai/degradation/:id/enable', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const config = await aiDegradationService.enableConfig(params.id);
      return reply.send(config);
    });

    // POST /api/v1/ai/degradation/:id/disable - 禁用降级配置
    this.app.post('/api/v1/ai/degradation/:id/disable', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const config = await aiDegradationService.disableConfig(params.id);
      return reply.send(config);
    });

    // GET /api/v1/ai/degradation/:id/history - 获取降级历史
    this.app.get('/api/v1/ai/degradation/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await aiDegradationService.getHistory(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/ai/degradation/:id/trigger - 手动触发降级
    this.app.post('/api/v1/ai/degradation/:id/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = (request.body || {}) as TriggerDegradationRequest;

      const history = await aiDegradationService.triggerDegradation(params.id, body);
      return reply.send(history);
    });

    // POST /api/v1/ai/degradation/:id/recover - 恢复服务
    this.app.post('/api/v1/ai/degradation/:id/recover', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const config = await aiDegradationService.recoverService(params.id);
      return reply.send(config);
    });
  }
}