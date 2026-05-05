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
import pino from 'pino';
import {
  CircuitState,
  AIScenario,
  CircuitBreakerState,
  AIMetrics,
  AIGatewayEvent,
} from './types';
import { ProviderCircuitBreaker, ProviderMetrics, ProviderCircuitBreakerConfig } from './ProviderCircuitBreaker';

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

  constructor(config: Partial<CircuitBreakerManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.providerBreaker = new ProviderCircuitBreaker(this.config.providerConfig);

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
            providerIis.providerMap) {
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
}

// 导出默认实例
export const defaultCircuitBreakerManager = new CircuitBreakerManager();