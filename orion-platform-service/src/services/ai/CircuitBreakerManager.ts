/**
 * CircuitBreakerManager - 双层熔断统筹管理器
 *
 * 功能：
 * 1. 统筹 Provider级 + 场景级 双层熔断
 * 2. Provider 熔断后自动降级到其他 Provider
 * 3. 场景熔断触发降级策略
 * 4. 提供统一的状态查询和监控接口
 * 5. 发出双层熔断事件
 *
 * 双层熔断架构：
 * - Provider级：按 LLM Provider 维度（如 openai、claude、deepseek 等）
 *   - 熔断阈值：errorRate > 15%, timeout (P95) > 5s
 *   - 熔断后自动降级到备用 Provider
 * - 场景级：按业务场景维度（如 code-review、auto-scheduling 等）
 *   - 熔断阈值：保持 AIGateway.DEFAULT_CONFIG 配置
 *   - 熔断后触发降级策略
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import {
  CircuitState,
  AIScenario,
  CircuitBreakerState,
} from './types';
import { ProviderCircuitBreaker, ProviderMetrics, ProviderCircuitBreakerConfig } from './ProviderCircuitBreaker';
import {
  CBManagerScenarioStateRepository,
  CBManagerProviderRepository,
} from '../../repositories/CircuitBreakerManagerRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * LLM Provider 定义
 */
export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'claude' | 'deepseek' | 'local' | 'custom';
  priority: number; // 优先级，数字越小优先级越高
  enabled: boolean;
  config?: Record<string, unknown>;
}

/**
 * 双层熔断状态
 */
export interface DualCircuitState {
  providerId: string;
  providerState: CircuitState;
  scenario: AIScenario;
  scenarioState: CircuitState;
  combinedState: CircuitState; // 综合状态
  canProceed: boolean; // 是否可以继续执行
  shouldDegrade: boolean; // 是否需要降级
  degradationReason?: string;
  suggestedProvider?: string; // 建议使用的 Provider
}

/**
 * 双层熔断配置
 */
export interface CircuitBreakerManagerConfig {
  /** Provider 级熔断器配置 */
  providerConfig: Partial<ProviderCircuitBreakerConfig>;
  /** Provider 优先级列表 */
  providers: LLMProvider[];
  /** 是否启用双层熔断 */
  enabled: boolean;
  /** 降级时是否记录事件 */
  logDegradationEvents: boolean;
}

/**
 * 状态变更事件
 */
export interface DualCircuitEvent {
  type: 'provider_circuit_change' | 'scenario_circuit_change' | 'provider_fallback' | 'degradation_triggered';
  timestamp: Date;
  data: {
    providerId?: string;
    scenario?: AIScenario;
    oldState?: CircuitState;
    newState?: CircuitState;
    reason?: string;
    suggestedProvider?: string;
  };
}

/**
 * 健康状态摘要
 */
export interface HealthSummary {
  providers: Map<string, { state: CircuitState; metrics: ProviderMetrics | null }>;
  scenarios: Map<AIScenario, CircuitState>;
  overallHealthy: boolean;
}

const DEFAULT_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai', priority: 1, enabled: true },
  { id: 'claude', name: 'Claude', type: 'claude', priority: 2, enabled: true },
  { id: 'deepseek', name: 'DeepSeek', type: 'deepseek', priority: 3, enabled: true },
  { id: 'local', name: 'Local Model', type: 'local', priority: 4, enabled: true },
];

const DEFAULT_CONFIG: CircuitBreakerManagerConfig = {
  providerConfig: {},
  providers: DEFAULT_PROVIDERS,
  enabled: true,
  logDegradationEvents: true,
};

/**
 * 双层熔断管理器
 *
 * 负责统筹 Provider级和场景级熔断，提供统一的接口
 */
export class CircuitBreakerManager extends EventEmitter {
  private config: CircuitBreakerManagerConfig;
  private providerBreaker: ProviderCircuitBreaker;

  /** 场景级熔断状态（由 AIGateway 管理） */
  private scenarioStates: Map<AIScenario, CircuitBreakerState> = new Map();

  /** Provider 配置映射 */
  private providerMap: Map<string, LLMProvider> = new Map();

  // Repositories (optional, for PostgreSQL persistence)
  private scenarioStateRepo: CBManagerScenarioStateRepository | null = null;
  private providerRepo: CBManagerProviderRepository | null = null;

  constructor(
    config: Partial<CircuitBreakerManagerConfig> = {},
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.providerBreaker = new ProviderCircuitBreaker(this.config.providerConfig);

    // Initialize repositories if db is provided
    if (db) {
      this.scenarioStateRepo = new CBManagerScenarioStateRepository(db);
      this.providerRepo = new CBManagerProviderRepository(db);
    }

    // 初始化 Provider 映射
    for (const provider of this.config.providers) {
      if (provider.enabled) {
        this.providerMap.set(provider.id, provider);
      }
    }

    // 监听 Provider 状态变更事件
    this.providerBreaker.on('state:changed', (event) => {
      this.emit('dual:circuit:event', {
        type: 'provider_circuit_change',
        timestamp: new Date(),
        data: {
          providerId: event.providerId,
          oldState: event.oldState,
          newState: event.newState,
          reason: event.reason,
        },
      });

      logger.info({
        msg: 'Provider circuit state changed',
        providerId: event.providerId,
        oldState: event.oldState,
        newState: event.newState,
        reason: event.reason,
      });
    });
  }

  /**
   * 从数据库恢复状态（启动时调用）
   */
  async restoreState(): Promise<void> {
    if (!this.scenarioStateRepo) return;

    try {
      // Restore scenario states
      const scenarioEntities = await this.scenarioStateRepo.listAll();
      for (const entity of scenarioEntities) {
        this.scenarioStates.set(entity.scenario as AIScenario, {
          scenario: entity.scenario,
          state: entity.state as CircuitState,
          failureCount: entity.failure_count,
          successCount: entity.success_count,
          lastFailureTime: entity.last_failure_time || undefined,
          lastStateChangeTime: entity.last_state_change_time,
          halfOpenAttempts: entity.half_open_attempts,
        });
      }

      // Restore providers
      if (this.providerRepo) {
        const providerEntities = await this.providerRepo.listEnabled();
        for (const entity of providerEntities) {
          const provider: LLMProvider = {
            id: entity.provider_id,
            name: entity.name,
            type: entity.type as LLMProvider['type'],
            priority: entity.priority,
            enabled: entity.enabled,
            config: entity.config_json,
          };
          this.providerMap.set(provider.id, provider);
        }
      }

      logger.info({
        msg: 'CircuitBreakerManager state restored from DB',
        scenarioCount: scenarioEntities.length,
      });
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to restore CircuitBreakerManager state from DB', error });
    }
  }

  /**
   * 获取 Provider 级熔断器实例
   */
  getProviderBreaker(): ProviderCircuitBreaker {
    return this.providerBreaker;
  }

  /**
   * 更新场景级熔断状态（由 AIGateway 调用）
   */
  updateScenarioState(scenario: AIScenario, state: CircuitBreakerState): void {
    const oldState = this.scenarioStates.get(scenario);
    this.scenarioStates.set(scenario, state);

    if (oldState?.state !== state.state) {
      this.emit('dual:circuit:event', {
        type: 'scenario_circuit_change',
        timestamp: new Date(),
        data: {
          scenario,
          oldState: oldState?.state,
          newState: state.state,
        },
      });

      logger.info({
        msg: 'Scenario circuit state changed',
        scenario,
        oldState: oldState?.state,
        newState: state.state,
      });
    }

    // Persist to DB if available
    if (this.scenarioStateRepo) {
      this.scenarioStateRepo.upsertByScenario({
        id: `scenario-${scenario}`,
        scenario,
        state: state.state,
        failureCount: state.failureCount,
        successCount: state.successCount,
        lastFailureTime: state.lastFailureTime,
        lastStateChangeTime: state.lastStateChangeTime,
        halfOpenAttempts: state.halfOpenAttempts,
      }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist scenario state', error: err }));
    }
  }

  /**
   * 获取场景级熔断状态
   */
  getScenarioState(scenario: AIScenario): CircuitBreakerState | undefined {
    return this.scenarioStates.get(scenario);
  }

  /**
   * 获取 Provider 级熔断状态
   */
  getProviderState(providerId: string): CircuitState {
    return this.providerBreaker.getState(providerId);
  }

  /**
   * 获取默认 Provider（优先级最高的可用 Provider）
   */
  getDefaultProvider(): string {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      return 'openai'; // 默认 fallback
    }
    return availableProviders[0];
  }

  /**
   * 获取所有可用的 Provider（按优先级排序）
   */
  getAvailableProviders(): string[] {
    const providers = Array.from(this.providerMap.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    // 使用 ProviderCircuitBreaker 的可用性检查和排序
    const providerIds = providers.map((p) => p.id);
    return this.providerBreaker.getAvailableProviders(providerIds);
  }

  /**
   * 查找备用 Provider
   */
  findFallbackProvider(excludedProvider: string): string | undefined {
    const availableProviders = this.getAvailableProviders();
    return availableProviders.find((id) => id !== excludedProvider);
  }

  /**
   * 检查请求是否可以通过双层熔断
   */
  async checkDualCircuit(
    scenario: AIScenario,
    preferredProvider?: string
  ): Promise<DualCircuitState> {
    if (!this.config.enabled) {
      return {
        providerId: preferredProvider || 'openai',
        providerState: 'CLOSED',
        scenario,
        scenarioState: 'CLOSED',
        combinedState: 'CLOSED',
        canProceed: true,
        shouldDegrade: false,
      };
    }

    // 检查场景级熔断
    const scenarioState = this.scenarioStates.get(scenario);
    const scenarioCircuitState = scenarioState?.state || 'CLOSED';

    // 检查 Provider 级熔断
    const requestedProvider = preferredProvider || this.getDefaultProvider();
    const providerState = this.providerBreaker.getState(requestedProvider);

    // 计算综合状态
    let combinedState: CircuitState;
    let canProceed: boolean;
    let shouldDegrade: boolean;
    let degradationReason: string | undefined;
    let suggestedProvider: string | undefined;

    if (scenarioCircuitState === 'OPEN') {
      // 场景级熔断打开，直接降级
      combinedState = 'OPEN';
      canProceed = false;
      shouldDegrade = true;
      degradationReason = 'scenario_circuit_open';
    } else if (providerState === 'OPEN') {
      // Provider 级熔断打开，尝试降级到备用 Provider
      const fallbackProvider = this.findFallbackProvider(requestedProvider);
      if (fallbackProvider) {
        combinedState = 'HALF_OPEN';
        canProceed = true;
        shouldDegrade = false;
        suggestedProvider = fallbackProvider;

        this.emit('dual:circuit:event', {
          type: 'provider_fallback',
          timestamp: new Date(),
          data: {
            providerId: requestedProvider,
            suggestedProvider: fallbackProvider,
            reason: 'provider_circuit_open',
          },
        });

        logger.info({
          msg: 'Provider fallback triggered',
          fromProvider: requestedProvider,
          toProvider: fallbackProvider,
        });
      } else {
        // 没有可用的备用 Provider，需要降级
        combinedState = 'OPEN';
        canProceed = false;
        shouldDegrade = true;
        degradationReason = 'no_available_provider';
      }
    } else if (providerState === 'HALF_OPEN' || scenarioCircuitState === 'HALF_OPEN') {
      // 任一层处于半开状态，允许探测请求
      combinedState = 'HALF_OPEN';
      canProceed = true;
      shouldDegrade = false;
    } else {
      // 双层都处于关闭状态，正常执行
      combinedState = 'CLOSED';
      canProceed = true;
      shouldDegrade = false;
    }

    return {
      providerId: requestedProvider,
      providerState,
      scenario,
      scenarioState: scenarioCircuitState,
      combinedState,
      canProceed,
      shouldDegrade,
      degradationReason,
      suggestedProvider,
    };
  }

  /**
   * Provider 请求前检查
   */
  async beforeProviderRequest(providerId: string): Promise<boolean> {
    return this.providerBreaker.beforeRequest(providerId);
  }

  /**
   * Provider 请求后记录结果
   */
  async afterProviderRequest(
    providerId: string,
    success: boolean,
    latency: number = 0
  ): Promise<void> {
    return this.providerBreaker.afterRequest(providerId, success, latency);
  }

  /**
   * 获取所有 Provider 的指标
   */
  getAllProviderMetrics(): ProviderMetrics[] {
    return this.providerBreaker.getAllMetrics();
  }

  /**
   * 获取特定 Provider 的指标
   */
  getProviderMetrics(providerId: string): ProviderMetrics | null {
    return this.providerBreaker.getMetrics(providerId);
  }

  /**
   * 手动重置 Provider 熔断器
   */
  resetProvider(providerId: string): void {
    this.providerBreaker.reset(providerId);
  }

  /**
   * 手动触发 Provider 熔断
   */
  tripProvider(providerId: string, reason: string = 'manual'): void {
    this.providerBreaker.trip(providerId, reason);
  }

  /**
   * 手动重置场景熔断器
   */
  resetScenario(scenario: AIScenario): void {
    const currentState = this.scenarioStates.get(scenario);
    if (currentState) {
      currentState.state = 'CLOSED';
      currentState.failureCount = 0;
      currentState.successCount = 0;
      currentState.halfOpenAttempts = 0;
      currentState.lastStateChangeTime = new Date();
      this.scenarioStates.set(scenario, currentState);

      this.emit('dual:circuit:event', {
        type: 'scenario_circuit_change',
        timestamp: new Date(),
        data: {
          scenario,
          oldState: 'OPEN',
          newState: 'CLOSED',
          reason: 'manual_reset',
        },
      });

      // Persist to DB
      if (this.scenarioStateRepo) {
        this.scenarioStateRepo.upsertByScenario({
          id: `scenario-${scenario}`,
          scenario,
          state: 'CLOSED',
          failureCount: 0,
          successCount: 0,
          lastStateChangeTime: currentState.lastStateChangeTime,
          halfOpenAttempts: 0,
        }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist scenario state reset', error: err }));
      }
    }
  }

  /**
   * 获取健康状态摘要
   */
  getHealthSummary(): HealthSummary {
    const providerHealth = new Map<string, { state: CircuitState; metrics: ProviderMetrics | null }>();
    for (const providerId of this.providerMap.keys()) {
      providerHealth.set(providerId, {
        state: this.providerBreaker.getState(providerId),
        metrics: this.providerBreaker.getMetrics(providerId),
      });
    }

    const scenarioHealth = new Map<AIScenario, CircuitState>();
    for (const [scenario, state] of this.scenarioStates) {
      scenarioHealth.set(scenario, state.state);
    }

    // 判断整体健康状态
    const hasOpenProvider = Array.from(this.providerMap.keys()).some(
      (id) => this.providerBreaker.getState(id) === 'OPEN'
    );
    const hasOpenScenario = Array.from(this.scenarioStates.values()).some(
      (s) => s.state === 'OPEN'
    );
    const overallHealthy = !hasOpenProvider && !hasOpenScenario;

    return {
      providers: providerHealth,
      scenarios: scenarioHealth,
      overallHealthy,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CircuitBreakerManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新 Provider 映射
    if (config.providers) {
      this.providerMap.clear();
      for (const provider of config.providers) {
        if (provider.enabled) {
          this.providerMap.set(provider.id, provider);
        }
      }
    }

    // 更新 Provider 熔断器配置
    if (config.providerConfig) {
      this.providerBreaker.updateConfig(config.providerConfig);
    }

    logger.info('[CircuitBreakerManager] Config updated');
  }

  /**
   * 获取配置
   */
  getConfig(): CircuitBreakerManagerConfig {
    return { ...this.config };
  }

  /**
   * 添加 Provider
   */
  addProvider(provider: LLMProvider): void {
    if (provider.enabled) {
      this.providerMap.set(provider.id, provider);
      this.config.providers.push(provider);
      logger.info({ msg: 'Provider added', providerId: provider.id });

      // Persist to DB
      if (this.providerRepo) {
        this.providerRepo.upsertByProviderId({
          id: `provider-${provider.id}`,
          providerId: provider.id,
          name: provider.name,
          type: provider.type,
          priority: provider.priority,
          enabled: provider.enabled,
          configJson: provider.config,
        }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist provider', error: err }));
      }
    }
  }

  /**
   * 移除 Provider
   */
  removeProvider(providerId: string): void {
    this.providerMap.delete(providerId);
    this.config.providers = this.config.providers.filter((p) => p.id !== providerId);
    logger.info({ msg: 'Provider removed', providerId });

    // Persist to DB
    if (this.providerRepo) {
      this.providerRepo.deleteByProviderId(providerId).catch(err =>
        logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to remove provider from DB', error: err })
      );
    }
  }

  /**
   * 启用/禁用 Provider
   */
  setProviderEnabled(providerId: string, enabled: boolean): void {
    const provider = this.providerMap.get(providerId);
    if (provider) {
      provider.enabled = enabled;
      if (!enabled) {
        this.providerMap.delete(providerId);
      } else {
        this.providerMap.set(providerId, provider);
      }
      logger.info({ msg: 'Provider enabled/disabled', providerId, enabled });

      // Persist to DB
      if (this.providerRepo) {
        this.providerRepo.upsertByProviderId({
          id: `provider-${providerId}`,
          providerId,
          name: provider.name,
          type: provider.type,
          priority: provider.priority,
          enabled,
          configJson: provider.config,
        }).catch(err => logger.error({ traceId: getCurrentTraceId(), msg: 'Failed to persist provider enabled state', error: err }));
      }
    }
  }
}

// 导出默认实例
export const defaultCircuitBreakerManager = new CircuitBreakerManager();