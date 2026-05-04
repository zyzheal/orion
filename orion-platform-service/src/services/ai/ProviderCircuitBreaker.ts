/**
 * Provider Circuit Breaker - Provider级熔断器
 *
 * 功能：
 * 1. 按Provider维度跟踪失败率（30%阈值触发OPEN）
 * 2. 支持三种状态：CLOSED, OPEN, HALF_OPEN
 * 3. HALF_OPEN状态允许探测请求（3个探测）
 * 4. 成功率>50%时转换到CLOSED状态
 * 5. OPEN状态持续5分钟后尝试恢复
 * 6. 按Provider维度跟踪指标
 * 7. 发出状态变更事件
 *
 * 与AIGateway的场景级熔断器配合使用，形成双层熔断架构：
 * - Provider级：按LLM Provider维度（如openai、claude、deepseek等）
 * - 场景级：按业务场景维度（如code-review、auto-scheduling等）
 */

import { EventEmitter } from 'events';
import pino from 'pino';
import { CircuitState } from './types';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Provider熔断器配置
 */
export interface ProviderCircuitBreakerConfig {
  /** 失败率阈值，0.3 = 30%失败率触发OPEN */
  failureThreshold: number;
  /** 成功率阈值，0.5 = 50%成功率恢复到CLOSED */
  successThreshold: number;
  /** 统计时间窗口（毫秒），默认60秒 */
  timeoutWindow: number;
  /** HALF_OPEN状态下允许的探测请求数，默认3 */
  halfOpenRequests: number;
  /** OPEN状态持续时间（毫秒），默认5分钟 */
  openDuration: number;
}

/**
 * Provider指标
 */
export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  failedRequests: number;
  successRequests: number;
  failureRate: number;
  successRate: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  avgLatency: number;
  p95Latency: number;
}

/**
 * Provider熔断器状态详情
 */
export interface ProviderCircuitStateDetail {
  providerId: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  lastStateChangeTime: Date;
  halfOpenProbeCount: number;
  openStartTime?: Date;
}

/**
 * 状态变更事件
 */
export interface ProviderStateChangeEvent {
  providerId: string;
  oldState: CircuitState;
  newState: CircuitState;
  timestamp: Date;
  reason: string;
  metrics?: ProviderMetrics;
}

/**
 * 请求记录
 */
interface RequestRecord {
  success: boolean;
  latency: number;
  timestamp: Date;
}

const DEFAULT_CONFIG: ProviderCircuitBreakerConfig = {
  failureThreshold: 0.3, // 30%失败率触发OPEN
  successThreshold: 0.5, // 50%成功率恢复CLOSED
  timeoutWindow: 60000, // 60秒统计窗口
  halfOpenRequests: 3, // 3个探测请求
  openDuration: 300000, // 5分钟OPEN状态
};

/**
 * Provider级熔断器
 *
 * 用于按LLM Provider维度进行熔断控制，当某个Provider出现问题时，
 * 可以快速切换到备用Provider，而不影响其他Provider的正常服务。
 */
export class ProviderCircuitBreaker extends EventEmitter {
  private config: ProviderCircuitBreakerConfig;

  /** Provider -> 熔断器状态 */
  private states: Map<string, ProviderCircuitStateDetail> = new Map();

  /** Provider -> 指标 */
  private metrics: Map<string, ProviderMetrics> = new Map();

  /** Provider -> 请求历史（用于计算失败率） */
  private requestHistory: Map<string, RequestRecord[]> = new Map();

  /** Provider -> OPEN状态开始时间 */
  private openStartTimes: Map<string, Date> = new Map();

  constructor(config: Partial<ProviderCircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取Provider的熔断器状态
   */
  getState(providerId: string): CircuitState {
    const stateDetail = this.states.get(providerId);
    if (!stateDetail) {
      return 'CLOSED';
    }

    // 如果是OPEN状态，检查是否可以转为HALF_OPEN
    if (stateDetail.state === 'OPEN') {
      const openStart = this.openStartTimes.get(providerId);
      if (openStart) {
        const elapsed = Date.now() - openStart.getTime();
        if (elapsed >= this.config.openDuration) {
          // 超过OPEN持续时间，转为HALF_OPEN
          this.transitionTo(providerId, 'HALF_OPEN', 'open_duration_expired');
        }
      }
    }

    return this.states.get(providerId)?.state || 'CLOSED';
  }

  /**
   * 获取Provider的详细状态
   */
  getStateDetail(providerId: string): ProviderCircuitStateDetail | null {
    this.getState(providerId); // 触发状态检查
    return this.states.get(providerId) || null;
  }

  /**
   * 获取Provider的指标
   */
  getMetrics(providerId: string): ProviderMetrics | null {
    return this.metrics.get(providerId) || null;
  }

  /**
   * 获取所有Provider的指标
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 请求前检查
   * 返回true表示允许请求，false表示应该拒绝
   */
  async beforeRequest(providerId: string): Promise<boolean> {
    this.ensureProviderInitialized(providerId);
    const state = this.getState(providerId);

    if (state === 'CLOSED') {
      // CLOSED状态允许所有请求
      return true;
    }

    if (state === 'OPEN') {
      // OPEN状态拒绝所有请求（状态检查已在getState中处理）
      logger.debug(`[ProviderCircuitBreaker] ${providerId} is OPEN, rejecting request`);
      return false;
    }

    if (state === 'HALF_OPEN') {
      // HALF_OPEN状态允许有限的探测请求
      const stateDetail = this.states.get(providerId)!;
      if (stateDetail.halfOpenProbeCount < this.config.halfOpenRequests) {
        stateDetail.halfOpenProbeCount++;
        logger.info(
          `[ProviderCircuitBreaker] ${providerId} HALF_OPEN probe ${stateDetail.halfOpenProbeCount}/${this.config.halfOpenRequests}`
        );
        return true;
      }
      // 探测请求已用完
      logger.debug(`[ProviderCircuitBreaker] ${providerId} HALF_OPEN probes exhausted`);
      return false;
    }

    return false;
  }

  /**
   * 请求后记录结果
   */
  async afterRequest(providerId: string, success: boolean, latency: number = 0): Promise<void> {
    this.ensureProviderInitialized(providerId);

    // 记录请求
    const history = this.requestHistory.get(providerId) || [];
    history.push({
      success,
      latency,
      timestamp: new Date(),
    });

    // 保持窗口大小
    const cutoff = Date.now() - this.config.timeoutWindow;
    const filtered = history.filter((r) => r.timestamp.getTime() > cutoff);
    this.requestHistory.set(providerId, filtered);

    // 更新指标
    this.updateMetrics(providerId, filtered);

    // 更新状态
    const state = this.getState(providerId);
    const stateDetail = this.states.get(providerId)!;

    if (success) {
      stateDetail.successCount++;
      stateDetail.lastSuccessTime = new Date();

      if (state === 'HALF_OPEN') {
        // HALF_OPEN状态下成功，检查是否可以转为CLOSED
        const metrics = this.metrics.get(providerId)!;
        if (metrics.successRate >= this.config.successThreshold) {
          this.transitionTo(providerId, 'CLOSED', 'success_threshold_reached');
        }
      }
    } else {
      stateDetail.failureCount++;
      stateDetail.lastFailureTime = new Date();

      if (state === 'HALF_OPEN') {
        // HALF_OPEN状态下失败，回到OPEN
        this.transitionTo(providerId, 'OPEN', 'half_open_failure');
      } else if (state === 'CLOSED') {
        // CLOSED状态下失败，检查是否需要转为OPEN
        const metrics = this.metrics.get(providerId)!;
        if (metrics.failureRate >= this.config.failureThreshold) {
          this.transitionTo(providerId, 'OPEN', 'failure_threshold_reached');
        }
      }
    }
  }

  /**
   * 手动重置Provider熔断器
   */
  reset(providerId: string): void {
    this.states.set(providerId, {
      providerId,
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChangeTime: new Date(),
      halfOpenProbeCount: 0,
    });
    this.requestHistory.delete(providerId);
    this.openStartTimes.delete(providerId);

    // 重置指标
    this.metrics.set(providerId, {
      providerId,
      totalRequests: 0,
      failedRequests: 0,
      successRequests: 0,
      failureRate: 0,
      successRate: 0,
      avgLatency: 0,
      p95Latency: 0,
    });

    logger.info(`[ProviderCircuitBreaker] ${providerId} reset to CLOSED`);
    this.emit('provider:reset', { providerId, timestamp: new Date() });
  }

  /**
   * 手动打开Provider熔断器
   */
  trip(providerId: string, reason: string = 'manual'): void {
    this.ensureProviderInitialized(providerId);
    this.transitionTo(providerId, 'OPEN', reason);
  }

  /**
   * 获取所有处于OPEN状态的Provider
   */
  getOpenProviders(): string[] {
    const openProviders: string[] = [];
    for (const [providerId] of this.states) {
      if (this.getState(providerId) === 'OPEN') {
        openProviders.push(providerId);
      }
    }
    return openProviders;
  }

  /**
   * 获取所有处于HALF_OPEN状态的Provider
   */
  getHalfOpenProviders(): string[] {
    const halfOpenProviders: string[] = [];
    for (const [providerId] of this.states) {
      if (this.getState(providerId) === 'HALF_OPEN') {
        halfOpenProviders.push(providerId);
      }
    }
    return halfOpenProviders;
  }

  /**
   * 检查Provider是否可用
   */
  isAvailable(providerId: string): boolean {
    const state = this.getState(providerId);
    return state === 'CLOSED' || state === 'HALF_OPEN';
  }

  /**
   * 获取可用的Provider列表（按健康度排序）
   */
  getAvailableProviders(providerIds: string[]): string[] {
    return providerIds
      .filter((id) => this.isAvailable(id))
      .sort((a, b) => {
        // 按失败率排序，失败率低的优先
        const metricsA = this.metrics.get(a);
        const metricsB = this.metrics.get(b);
        const failureRateA = metricsA?.failureRate || 0;
        const failureRateB = metricsB?.failureRate || 0;
        return failureRateA - failureRateB;
      });
  }

  /**
   * 更新指标
   */
  private updateMetrics(providerId: string, history: RequestRecord[]): void {
    const total = history.length;
    const failed = history.filter((r) => !r.success).length;
    const success = total - failed;

    const totalLatency = history.reduce((sum, r) => sum + r.latency, 0);
    const avgLatency = total > 0 ? totalLatency / total : 0;

    // 计算P95延迟
    const latencies = history.map((r) => r.latency).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || latencies[latencies.length - 1] || 0;

    const lastFailure = [...history].reverse().find((r) => !r.success);
    const lastSuccess = [...history].reverse().find((r) => r.success);

    const metrics: ProviderMetrics = {
      providerId,
      totalRequests: total,
      failedRequests: failed,
      successRequests: success,
      failureRate: total > 0 ? failed / total : 0,
      successRate: total > 0 ? success / total : 0,
      avgLatency,
      p95Latency,
      lastFailureTime: lastFailure?.timestamp,
      lastSuccessTime: lastSuccess?.timestamp,
    };

    this.metrics.set(providerId, metrics);
  }

  /**
   * 状态转换
   */
  private transitionTo(providerId: string, newState: CircuitState, reason: string): void {
    const oldState = this.getState(providerId);
    if (oldState === newState) {
      return;
    }

    const stateDetail = this.states.get(providerId) || {
      providerId,
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChangeTime: new Date(),
      halfOpenProbeCount: 0,
    };

    stateDetail.state = newState;
    stateDetail.lastStateChangeTime = new Date();

    if (newState === 'HALF_OPEN') {
      stateDetail.halfOpenProbeCount = 0;
    }

    if (newState === 'OPEN') {
      this.openStartTimes.set(providerId, new Date());
    } else {
      this.openStartTimes.delete(providerId);
    }

    this.states.set(providerId, stateDetail);

    const event: ProviderStateChangeEvent = {
      providerId,
      oldState,
      newState,
      timestamp: new Date(),
      reason,
      metrics: this.metrics.get(providerId) || undefined,
    };

    logger.info(
      `[ProviderCircuitBreaker] ${providerId} transitioned: ${oldState} -> ${newState} (reason: ${reason})`
    );
    this.emit('state:changed', event);
  }

  /**
   * 确保Provider已初始化
   */
  private ensureProviderInitialized(providerId: string): void {
    if (!this.states.has(providerId)) {
      this.states.set(providerId, {
        providerId,
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastStateChangeTime: new Date(),
        halfOpenProbeCount: 0,
      });
    }

    if (!this.metrics.has(providerId)) {
      this.metrics.set(providerId, {
        providerId,
        totalRequests: 0,
        failedRequests: 0,
        successRequests: 0,
        failureRate: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
      });
    }

    if (!this.requestHistory.has(providerId)) {
      this.requestHistory.set(providerId, []);
    }
  }

  /**
   * 清理过期的历史数据
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.timeoutWindow;
    for (const [providerId, history] of this.requestHistory) {
      const filtered = history.filter((r) => r.timestamp.getTime() > cutoff);
      this.requestHistory.set(providerId, filtered);

      // 如果没有历史数据且状态不是OPEN，可以考虑清理
      if (filtered.length === 0 && this.getState(providerId) === 'CLOSED') {
        // 保留状态，只是清理历史
      }
    }
    logger.debug('[ProviderCircuitBreaker] Cleanup completed');
  }

  /**
   * 获取配置
   */
  getConfig(): ProviderCircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ProviderCircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[ProviderCircuitBreaker] Config updated:', config);
  }
}

// 导出默认实例
export const defaultProviderCircuitBreaker = new ProviderCircuitBreaker();